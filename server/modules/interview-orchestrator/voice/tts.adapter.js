const { textToSpeech: elevenLabsTextToSpeech } = require('../../../services/elevenlabs.service');
const env = require('../../../config/env');

const createTtsAdapter = ({ ttsProvider = null } = {}) => {
  const synthesizeSpeech = async ({ text, voiceId = null }) => {
    const cleanText = String(text || '')
      .replace(/[*_#`~>]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      return {
        ok: false,
        fallbackToBrowser: true,
        error: 'Empty speech text',
        metadata: { provider: 'none', fallbackToBrowser: true },
      };
    }

    const startedAt = Date.now();

    if (ttsProvider) {
      try {
        const res = await ttsProvider.synthesize({ text: cleanText, voiceId });
        if (!res || res.ok === false || !res.buffer || res.buffer.length === 0) {
          return {
            ok: false,
            fallbackToBrowser: true,
            error: res?.error || 'TTS provider returned empty audio',
            metadata: {
              provider: res?.provider || 'custom-tts',
              latencyMs: Date.now() - startedAt,
              fallbackToBrowser: true,
              lastError: res?.error || 'Empty audio',
            },
          };
        }
        return {
          ok: true,
          fallbackToBrowser: false,
          audioBase64: Buffer.from(res.buffer).toString('base64'),
          mimeType: res.mimeType || 'audio/mpeg',
          metadata: {
            provider: res.provider || 'custom-tts',
            model: res.model || 'test',
            voiceId: voiceId || res.voiceId || 'default',
            mimeType: res.mimeType || 'audio/mpeg',
            audioBytes: res.buffer.length,
            latencyMs: Date.now() - startedAt,
            fallbackToBrowser: false,
          },
        };
      } catch (err) {
        return {
          ok: false,
          fallbackToBrowser: true,
          error: err?.message || 'TTS synthesis failed',
          metadata: {
            provider: 'custom-tts',
            latencyMs: Date.now() - startedAt,
            fallbackToBrowser: true,
            lastError: err?.message || 'TTS synthesis failed',
          },
        };
      }
    }

    const elevenLabsKey = env.ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      try {
        const { buffer, mimeType } = await elevenLabsTextToSpeech(cleanText, elevenLabsKey, {
          voiceId: voiceId || env.ELEVENLABS_VOICE_ID,
        });
        if (buffer && buffer.length > 100) {
          return {
            ok: true,
            fallbackToBrowser: false,
            audioBase64: buffer.toString('base64'),
            mimeType,
            metadata: {
              provider: 'elevenlabs',
              model: 'eleven_flash_v2_5',
              voiceId: voiceId || env.ELEVENLABS_VOICE_ID,
              mimeType,
              audioBytes: buffer.length,
              latencyMs: Date.now() - startedAt,
              fallbackToBrowser: false,
            },
          };
        }
      } catch (err) {
        return {
          ok: false,
          fallbackToBrowser: true,
          error: err?.message || 'ElevenLabs TTS failed',
          metadata: {
            provider: 'elevenlabs',
            latencyMs: Date.now() - startedAt,
            fallbackToBrowser: true,
            lastError: err?.message || 'ElevenLabs TTS failed',
          },
        };
      }
    }

    return {
      ok: false,
      fallbackToBrowser: true,
      error: 'No external TTS key configured; browser speech synthesis fallback active',
      metadata: {
        provider: 'browser-fallback',
        latencyMs: Date.now() - startedAt,
        fallbackToBrowser: true,
      },
    };
  };

  return {
    synthesizeSpeech,
  };
};

module.exports = {
  createTtsAdapter,
};
