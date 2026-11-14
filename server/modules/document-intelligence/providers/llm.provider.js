const { GoogleGenAI } = require('@google/genai');
const env = require('../../../config/env');

class LlmProviderError extends Error {
  constructor(message, category = 'TRANSIENT', cause = null) {
    super(message);
    this.name = 'LlmProviderError';
    this.category = category; // 'RATE_LIMIT' | 'AUTH_ERROR' | 'TRANSIENT' | 'INVALID_JSON' | 'TIMEOUT'
    this.cause = cause;
  }
}

const classifyProviderError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  if (
    msg.includes('api_key_invalid') ||
    msg.includes('permission_denied') ||
    msg.includes('invalid api key') ||
    msg.includes('no gemini api key')
  ) {
    return 'AUTH_ERROR';
  }
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
    return 'RATE_LIMIT';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    return 'TIMEOUT';
  }
  if (msg.includes('invalid json') || msg.includes('unexpected token')) {
    return 'INVALID_JSON';
  }
  return 'TRANSIENT';
};

/**
 * Gemini-backed structured extraction provider with timeout, low-variance config,
 * token usage metadata, and error classification.
 */
class GeminiExtractionProvider {
  constructor({ apiKey = env.GEMINI_API_KEY, model = env.AI_EXTRACTION_MODEL, timeoutMs = env.DOCUMENT_EXTRACTION_TIMEOUT_MS } = {}) {
    this.providerName = 'gemini';
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async generateStructuredJson({ systemInstruction, userPrompt, requestId, signal = undefined }) {
    if (!this.apiKey) {
      throw new LlmProviderError('No Gemini API key configured', 'AUTH_ERROR');
    }
    if (signal?.aborted) {
      throw new LlmProviderError('Extraction aborted due to lease loss', 'TIMEOUT');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort(signal.reason);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 8192,
          abortSignal: controller.signal,
        },
      });

      const rawText = response.text || '';
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          parsed = JSON.parse(match[1]);
        } else {
          throw new LlmProviderError('Model returned invalid JSON', 'INVALID_JSON');
        }
      }

      const usage = response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0,
          }
        : null;

      return {
        data: parsed,
        provider: this.providerName,
        model: this.model,
        requestId,
        usage,
      };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      const category = classifyProviderError(err);
      throw new LlmProviderError(err?.message || 'LLM extraction failed', category, err);
    } finally {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }
}

module.exports = {
  GeminiExtractionProvider,
  LlmProviderError,
  classifyProviderError,
};
