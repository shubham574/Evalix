const { GoogleGenAI } = require('@google/genai');
const { speechToText: elevenLabsSpeechToText } = require('../../../services/elevenlabs.service');
const {
  normalizeAudioMimeType,
  sanitizeTranscript,
} = require('../../../controllers/transcription.controller');
const env = require('../../../config/env');

const createSttAdapter = ({ sttProvider = null } = {}) => {
  const transcribeAudioBuffer = async ({
    audioBuffer,
    mimeType = 'audio/webm',
    filename = 'audio.webm',
  }) => {
    const startedAt = Date.now();
    if (!audioBuffer || audioBuffer.length < 50) {
      return {
        transcript: '',
        emptyTranscript: true,
        metadata: {
          provider: 'none',
          latencyMs: Date.now() - startedAt,
          mimeType,
        },
      };
    }

    if (sttProvider) {
      const res = await sttProvider.transcribe({ audioBuffer, mimeType, filename });
      const cleaned = sanitizeTranscript(res?.transcript || '');
      return {
        transcript: cleaned,
        emptyTranscript: cleaned.length === 0,
        metadata: {
          provider: res?.provider || 'custom-stt',
          model: res?.model || 'test',
          confidence: res?.confidence ?? null,
          latencyMs: Date.now() - startedAt,
          mimeType,
        },
      };
    }

    const normalizedMime = normalizeAudioMimeType(mimeType, filename);
    const elevenLabsKey = env.ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      try {
        const raw = await elevenLabsSpeechToText(audioBuffer, elevenLabsKey, {
          mimeType: normalizedMime === 'audio/mp3' ? 'audio/mpeg' : normalizedMime,
          filename,
        });
        const cleaned = sanitizeTranscript(raw);
        if (cleaned) {
          return {
            transcript: cleaned,
            emptyTranscript: false,
            metadata: {
              provider: 'elevenlabs',
              model: 'scribe_v1',
              latencyMs: Date.now() - startedAt,
              mimeType: normalizedMime,
            },
          };
        }
      } catch (_err) {
        // Fall through to Gemini fallback
      }
    }

    const geminiKey = env.LIVE_INTERVIEW_GEMINI_API_KEY || env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        transcript: '',
        emptyTranscript: true,
        metadata: {
          provider: 'unavailable',
          latencyMs: Date.now() - startedAt,
          mimeType: normalizedMime,
        },
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Return ONLY the verbatim spoken speech from this audio. If silent, return empty string.',
            },
            {
              inlineData: {
                mimeType: normalizedMime,
                data: audioBuffer.toString('base64'),
              },
            },
          ],
        },
      ],
    });
    const cleaned = sanitizeTranscript(response?.text || '');
    return {
      transcript: cleaned,
      emptyTranscript: cleaned.length === 0,
      metadata: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        latencyMs: Date.now() - startedAt,
        mimeType: normalizedMime,
      },
    };
  };

  const resolveCandidateInput = async ({
    audioBuffer = null,
    mimeType = 'audio/webm',
    filename = 'audio.webm',
    transcriptText = '',
    transcriptStatus = 'FINAL',
    confidence = null,
  }) => {
    const normalizedStatus = String(transcriptStatus || 'FINAL').toUpperCase();
    if (normalizedStatus === 'PARTIAL') {
      return {
        ignoredForDecision: true,
        reason: 'PARTIAL_TRANSCRIPT_IGNORED',
        transcriptStatus: 'PARTIAL',
        transcript: sanitizeTranscript(transcriptText || ''),
        emptyTranscript: false,
        metadata: {
          provider: 'stream-partial',
          confidence,
          partialIgnored: true,
        },
      };
    }

    if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
      const sttRes = await transcribeAudioBuffer({ audioBuffer, mimeType, filename });
      return {
        ignoredForDecision: false,
        transcriptStatus: sttRes.emptyTranscript ? 'EMPTY' : normalizedStatus,
        transcript: sttRes.transcript,
        emptyTranscript: sttRes.emptyTranscript,
        metadata: {
          ...sttRes.metadata,
          confidence,
        },
      };
    }

    const cleaned = sanitizeTranscript(transcriptText || '');
    return {
      ignoredForDecision: false,
      transcriptStatus: cleaned.length === 0 ? 'EMPTY' : normalizedStatus,
      transcript: cleaned,
      emptyTranscript: cleaned.length === 0,
      metadata: {
        provider: 'client-transcript',
        confidence,
        latencyMs: 0,
      },
    };
  };

  return {
    transcribeAudioBuffer,
    resolveCandidateInput,
  };
};

module.exports = {
  createSttAdapter,
};
