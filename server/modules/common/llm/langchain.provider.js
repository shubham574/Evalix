/**
 * LangChain-backed structured JSON provider.
 *
 * Drop-in replacement for GeminiExtractionProvider: same `generateStructuredJson` contract
 * ({ data, provider, model, requestId, usage }) and the same LlmProviderError categories, so the
 * modules calling it are unchanged. On top of the native provider it adds:
 *  - automatic retries with backoff for transient/rate-limit errors (LLM_MAX_RETRIES)
 *  - model fallbacks: a second Gemini model (LLM_FALLBACK_MODEL) and, when their packages and keys
 *    are present, OpenAI (@langchain/openai) / Anthropic (@langchain/anthropic)
 *  - LangSmith tracing of every call when LANGSMITH_TRACING=true and LANGSMITH_API_KEY are set
 */
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { RunnableLambda } = require('@langchain/core/runnables');
const env = require('../../../config/env');
const {
  LlmProviderError,
  classifyProviderError,
} = require('../../document-intelligence/providers/llm.provider');

const optionalRequire = (name) => {
  try {
    return require(name);
  } catch (_) {
    return null;
  }
};

/** Parse model output as JSON, tolerating a fenced ```json block (same as the native provider). */
const parseJsonText = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch {
    const match = String(rawText).match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        /* fall through */
      }
    }
    throw new LlmProviderError('Model returned invalid JSON', 'INVALID_JSON');
  }
};

const messageText = (message) => {
  const { content } = message || {};
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  return '';
};

/** Build the ordered list of chat models: primary Gemini, then any configured fallbacks. */
const buildModelChain = ({ apiKey, model, fallbackModel, temperature, maxRetries }) => {
  const chain = [];
  const gemini = (name) =>
    new ChatGoogleGenerativeAI({
      model: name,
      apiKey,
      temperature,
      maxOutputTokens: 8192,
      json: true,
      maxRetries,
    });

  if (apiKey) {
    chain.push({ name: model, provider: 'gemini', llm: gemini(model) });
    if (fallbackModel && fallbackModel !== model) {
      chain.push({ name: fallbackModel, provider: 'gemini', llm: gemini(fallbackModel) });
    }
  }

  if (env.OPENAI_API_KEY && env.LLM_FALLBACK_OPENAI_MODEL) {
    const openai = optionalRequire('@langchain/openai');
    if (openai) {
      chain.push({
        name: env.LLM_FALLBACK_OPENAI_MODEL,
        provider: 'openai',
        llm: new openai.ChatOpenAI({
          model: env.LLM_FALLBACK_OPENAI_MODEL,
          apiKey: env.OPENAI_API_KEY,
          temperature,
          maxRetries,
          modelKwargs: { response_format: { type: 'json_object' } },
        }),
      });
    }
  }

  if (env.ANTHROPIC_API_KEY && env.LLM_FALLBACK_ANTHROPIC_MODEL) {
    const anthropic = optionalRequire('@langchain/anthropic');
    if (anthropic) {
      chain.push({
        name: env.LLM_FALLBACK_ANTHROPIC_MODEL,
        provider: 'anthropic',
        llm: new anthropic.ChatAnthropic({
          model: env.LLM_FALLBACK_ANTHROPIC_MODEL,
          apiKey: env.ANTHROPIC_API_KEY,
          temperature,
          maxRetries,
          maxTokens: 8192,
        }),
      });
    }
  }

  return chain;
};

class LangChainStructuredProvider {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey]        Gemini key (defaults to GEMINI_API_KEY)
   * @param {string} [options.model]         primary Gemini model
   * @param {string} [options.fallbackModel] secondary Gemini model tried when the primary fails
   * @param {number} [options.timeoutMs]     overall budget per call, across retries and fallbacks
   * @param {number} [options.maxRetries]    retries per model for transient errors
   * @param {number} [options.temperature]
   * @param {Array<{name:string, provider:string, llm:object}>} [options.models] inject models (tests)
   */
  constructor({
    apiKey = env.GEMINI_API_KEY,
    model = env.AI_EXTRACTION_MODEL,
    fallbackModel = env.LLM_FALLBACK_MODEL,
    timeoutMs = env.DOCUMENT_EXTRACTION_TIMEOUT_MS,
    maxRetries = env.LLM_MAX_RETRIES,
    temperature = 0.1,
    models = null,
  } = {}) {
    this.providerName = 'langchain';
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.models = models || buildModelChain({ apiKey, model, fallbackModel, temperature, maxRetries });
  }

  async generateStructuredJson({ systemInstruction, userPrompt, requestId, signal = undefined }) {
    if (this.models.length === 0) {
      throw new LlmProviderError('No Gemini API key configured', 'AUTH_ERROR');
    }
    if (signal?.aborted) {
      throw new LlmProviderError('Extraction aborted due to lease loss', 'TIMEOUT');
    }

    // One budget for the whole call (retries + fallbacks), plus the caller's cancellation signal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('LLM call timed out')), this.timeoutMs);
    const onAbort = () => controller.abort(signal.reason);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    // Tag each model's output with its name so the caller knows which link of the chain answered
    // (Gemini responses don't reliably carry the model name in response_metadata).
    const [primary, ...fallbacks] = this.models.map((m) =>
      m.llm.pipe(RunnableLambda.from((message) => ({ message, modelName: m.name, providerName: m.provider })))
    );
    const runnable = fallbacks.length ? primary.withFallbacks({ fallbacks }) : primary;

    try {
      const { message, modelName } = await runnable.invoke(
        [new SystemMessage(systemInstruction || ''), new HumanMessage(userPrompt)],
        {
          signal: controller.signal,
          runName: 'evalix.generateStructuredJson',
          tags: ['evalix'],
          metadata: { requestId },
        }
      );

      const data = parseJsonText(messageText(message));
      const used = message?.response_metadata?.model_name || modelName;
      const u = message?.usage_metadata;
      const usage = u
        ? {
            promptTokens: u.input_tokens || 0,
            completionTokens: u.output_tokens || 0,
            totalTokens: u.total_tokens || 0,
          }
        : null;

      return { data, provider: this.providerName, model: used, requestId, usage };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      // Our own budget or the caller's cancellation (lease loss): both are TIMEOUT, as in the native provider.
      const category = controller.signal.aborted ? 'TIMEOUT' : classifyProviderError(err);
      throw new LlmProviderError(err?.message || 'LLM call failed', category, err);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }
}

module.exports = { LangChainStructuredProvider, parseJsonText, buildModelChain };
