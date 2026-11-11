/**
 * ElevenLabs Text-to-Speech and Speech-to-Text service.
 * Uses the REST API directly via Node's built-in fetch / FormData / Blob (Node 18+).
 *
 * Docs:
 *  - TTS: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 *  - STT: POST https://api.elevenlabs.io/v1/speech-to-text
 */

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" – Shristi's voice (available on free tier)
const TTS_MODEL_ID = 'eleven_flash_v2_5'; // Low-latency model, ideal for live interviews
const STT_MODEL_ID = 'scribe_v1';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Resolve the ElevenLabs API key:
 * 1. Custom key passed via header 'x-elevenlabs-api-key'
 * 2. ELEVENLABS_API_KEY from process.env
 */
const resolveElevenLabsKey = (req) => {
  const headerKey = req?.headers?.['x-elevenlabs-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const envKey = process.env.ELEVENLABS_API_KEY;
  if (typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return null;
};

const readErrorBody = async (response) => {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json?.detail?.message || json?.detail?.status || JSON.stringify(json.detail || json);
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
};

/**
 * Convert text to speech. Returns { buffer, mimeType }.
 */
const textToSpeech = async (text, apiKey, { voiceId } = {}) => {
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType: 'audio/mpeg' };
};

/**
 * Transcribe an audio buffer. Returns the transcript string.
 */
const speechToText = async (audioBuffer, apiKey, { mimeType = 'audio/webm', filename = 'audio.webm', languageCode = 'en' } = {}) => {
  const form = new FormData();
  form.append('model_id', STT_MODEL_ID);
  if (languageCode) {
    form.append('language_code', languageCode);
  }
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([audioBuffer], { type: mimeType }), filename);

  const response = await fetch(`${ELEVENLABS_BASE_URL}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`ElevenLabs STT failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  return (data?.text || '').trim();
};

module.exports = {
  resolveElevenLabsKey,
  textToSpeech,
  speechToText,
};
