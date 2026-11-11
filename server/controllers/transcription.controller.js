const { GoogleGenAI } = require('@google/genai');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { GEMINI_API_KEY, LIVE_INTERVIEW_GEMINI_API_KEY } = require('../config/env');
const {
  resolveElevenLabsKey,
  textToSpeech: elevenLabsTextToSpeech,
  speechToText: elevenLabsSpeechToText,
} = require('../services/elevenlabs.service');

/**
 * Resolve which Gemini API key to use:
 * 1. Custom key passed via header 'x-gemini-api-key'
 * 2. Dedicated LIVE_INTERVIEW_GEMINI_API_KEY from process.env
 * 3. Default GEMINI_API_KEY from process.env
 */
const resolveApiKey = (req) => {
  const headerKey =
    req?.headers?.['x-gemini-api-key'] ||
    req?.headers?.['X-Gemini-Api-Key'] ||
    req?.headers?.['x-gemini-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const liveKey = process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  if (typeof liveKey === 'string' && liveKey.trim()) {
    return liveKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return null;
};

/**
 * Convert raw PCM buffer (e.g. from Gemini audio generation) to standard WAV buffer
 */
const pcmToWav = (pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) => {
  const safeBuffer = Buffer.isBuffer(pcmBuffer)
    ? pcmBuffer
    : Buffer.from(pcmBuffer || '');
  const safeSampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 24000;
  const safeChannels = Number.isFinite(numChannels) && numChannels > 0 ? numChannels : 1;
  const safeBits = Number.isFinite(bitsPerSample) && bitsPerSample > 0 ? bitsPerSample : 16;

  const byteRate = safeSampleRate * safeChannels * (safeBits / 8);
  const blockAlign = safeChannels * (safeBits / 8);
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + safeBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM format = 1
  wavHeader.writeUInt16LE(safeChannels, 22);
  wavHeader.writeUInt32LE(safeSampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(safeBits, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(safeBuffer.length, 40);

  return Buffer.concat([wavHeader, safeBuffer]);
};

/**
 * Normalize MIME type for Google Gemini multimodal audio input
 */
const normalizeAudioMimeType = (mimetype = '', originalname = '') => {
  let cleanType = (mimetype || '').trim().toLowerCase();
  if (cleanType.includes(';')) {
    cleanType = cleanType.split(';')[0].trim();
  }

  if (cleanType === 'audio/mp3' || cleanType === 'audio/mpeg') {
    return 'audio/mp3';
  }
  if (cleanType === 'audio/wav' || cleanType === 'audio/x-wav') {
    return 'audio/wav';
  }
  if (cleanType === 'audio/ogg' || cleanType === 'audio/vorbis') {
    return 'audio/ogg';
  }
  if (cleanType === 'audio/mp4' || cleanType === 'video/mp4' || cleanType === 'audio/x-m4a' || cleanType === 'audio/m4a') {
    return 'audio/mp4';
  }
  if (cleanType === 'audio/aac') {
    return 'audio/aac';
  }
  if (cleanType === 'audio/flac' || cleanType === 'audio/x-flac') {
    return 'audio/flac';
  }
  if (
    cleanType.includes('webm') ||
    cleanType === 'video/webm' ||
    cleanType === 'application/octet-stream' ||
    cleanType === 'binary/octet-stream'
  ) {
    // If extension reveals true format
    const ext = (originalname || '').split('.').pop().toLowerCase();
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'mp3') return 'audio/mp3';
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
    if (ext === 'aac') return 'audio/aac';
    if (ext === 'flac') return 'audio/flac';
    return 'audio/webm';
  }

  if (cleanType.startsWith('audio/')) {
    return cleanType;
  }

  // Fallback to extension or audio/webm
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'mp3') return 'audio/mp3';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'flac') return 'audio/flac';
  return 'audio/webm';
};

/**
 * Clean up transcripts: strip markdown/quotes and hallucinated silence tokens
 */
const sanitizeTranscript = (raw = '') => {
  let transcript = (raw || '').trim();

  // Strip wrapping markdown code blocks if returned
  transcript = transcript.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();

  // Strip wrapping quotes if the model wrapped the response in quotes
  if (
    transcript.length >= 2 &&
    ((transcript.startsWith('"') && transcript.endsWith('"')) ||
      (transcript.startsWith("'") && transcript.endsWith("'")))
  ) {
    transcript = transcript.slice(1, -1).trim();
  }

  // Sanitize hallucinated empty/silence tokens
  if (
    /^(\[.*\]|\(.*\)|<.*>|\*.*\*)$/.test(transcript) ||
    /^(no speech detected|silence|none|inaudible|unintelligible|no speech|no audio|blank|empty|static|ambient noise|no audible speech|no speech was heard)\.?$/i.test(transcript) ||
    /^(there is no speech|no speech was detected|no audio detected|i cannot hear any speech|please provide the audio|the audio contains no speech|the audio is silent|i cannot hear anything|there is no audible speech)/i.test(transcript) ||
    /^(i'm sorry|i am sorry).*?(no speech|no audio|cannot hear|no sound)/i.test(transcript)
  ) {
    transcript = '';
  }

  return transcript;
};

// @desc    Transcribe audio using ElevenLabs Scribe (fallback: Google Gemini multimodal)
// @route   POST /api/transcribe
// @access  Private
exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return next(new ApiError(400, 'No audio file provided'));
  }

  const elevenLabsKey = resolveElevenLabsKey(req);
  const apiKey = resolveApiKey(req);
  if (!elevenLabsKey && !apiKey) {
    return next(new ApiError(500, 'ElevenLabs or Gemini API key not configured for transcription'));
  }

  // Ultra-small buffers (< 50 bytes) cannot contain audible speech
  if (req.file.buffer.length < 50) {
    return res.status(200).json({ success: true, transcript: '' });
  }

  const mimeType = normalizeAudioMimeType(req.file.mimetype, req.file.originalname);

  // Primary: ElevenLabs Scribe speech-to-text
  if (elevenLabsKey) {
    try {
      const ext = mimeType.split('/')[1] || 'webm';
      const transcript = await elevenLabsSpeechToText(req.file.buffer, elevenLabsKey, {
        mimeType: mimeType === 'audio/mp3' ? 'audio/mpeg' : mimeType,
        filename: req.file.originalname || `audio.${ext}`,
      });
      return res.status(200).json({ success: true, transcript: sanitizeTranscript(transcript) });
    } catch (elErr) {
      console.warn('ElevenLabs STT failed:', elErr?.message || elErr);
      if (!apiKey) {
        return next(new ApiError(502, `Failed to transcribe audio: ${elErr?.message || elErr}`));
      }
      console.warn('Falling back to Gemini transcription...');
    }
  }

  try {
    const audioBase64 = req.file.buffer.toString('base64');
    const ai = new GoogleGenAI({ apiKey });

    const promptText =
      'You are a high-accuracy, verbatim audio transcription engine.\n' +
      'Transcribe all spoken speech in the provided audio file exactly as spoken.\n' +
      'Rules:\n' +
      '1. Return ONLY the verbatim transcribed text.\n' +
      '2. Do NOT add any preamble, conversational commentary, timestamps, speaker labels, punctuation notes, or markdown formatting.\n' +
      '3. If the audio has no audible speech, is silent, or contains only background noise, respond with an empty string.';

    const contents = [
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
      },
    ];

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.5-transcribe',
    ];
    let lastError = null;
    let transcript = '';

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
        });

        transcript = (
          response.text ||
          response.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ||
          ''
        ).trim();
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`Gemini STT attempt with model ${model} failed:`, errMsg);

        // Do not retry on invalid key
        const errLower = errMsg.toLowerCase();
        if (
          errLower.includes('api_key_invalid') ||
          errLower.includes('permission_denied') ||
          errLower.includes('api key')
        ) {
          break;
        }
      }
    }

    if (lastError && !transcript) {
      const lastMsg = lastError?.message || String(lastError);
      console.error('All Gemini STT attempts failed:', lastMsg);
      return next(new ApiError(502, `Failed to transcribe audio: ${lastMsg}`));
    }

    res.status(200).json({ success: true, transcript: sanitizeTranscript(transcript) });
  } catch (err) {
    const catchMsg = err?.message || String(err);
    console.error('Gemini transcription failed:', catchMsg);
    return next(new ApiError(502, `Failed to transcribe audio: ${catchMsg}`));
  }
});

// @desc    Generate speech using ElevenLabs TTS (fallback: Gemini TTS, then browser speech synthesis)
// @route   POST /api/transcribe/tts
// @access  Public / Private
exports.generateSpeech = asyncHandler(async (req, res, next) => {
  const text = req?.body?.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return next(new ApiError(400, 'No text provided'));
  }

  const elevenLabsKey = resolveElevenLabsKey(req);
  const apiKey = resolveApiKey(req);

  // Primary: ElevenLabs TTS
  if (elevenLabsKey) {
    const elText = text.replace(/[*_#`~>]/g, '').replace(/\n+/g, ' ').trim();
    if (elText) {
      try {
        const { buffer, mimeType } = await elevenLabsTextToSpeech(elText, elevenLabsKey);
        if (buffer && buffer.length > 100) {
          res.set('Content-Type', mimeType);
          return res.send(buffer);
        }
        console.warn('ElevenLabs TTS returned empty audio.');
      } catch (elErr) {
        console.warn('ElevenLabs TTS failed:', elErr?.message || elErr);
      }
    }
  }

  if (!apiKey) {
    return res.status(503).json({
      fallback: true,
      message: 'No TTS provider available, falling back to browser speech synthesis.',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const ttsModels = [
      'gemini-2.5-flash-preview-tts',
      'gemini-3.8-flash-tts',
      'gemini-3.1-flash-tts-preview',
    ];
    let audioBuffer = null;
    let audioMime = 'audio/wav';

    const cleanText = text
      .replace(/[*_#`~>]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(503).json({
        fallback: true,
        message: 'No readable speech text provided.',
      });
    }

    for (const model of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: cleanText,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede', // Natural female voice for Shristi
                },
              },
            },
          },
        });

        const candidate = response.candidates?.[0];
        const audioPart = candidate?.content?.parts?.find(
          (p) => p.inlineData && p.inlineData.data
        );

        if (audioPart && audioPart.inlineData?.data) {
          const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
          const mimeStr = (audioPart.inlineData.mimeType || '').toLowerCase();

          if (mimeStr.includes('pcm') || mimeStr.includes('l16')) {
            const rateMatch = mimeStr.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            audioBuffer = pcmToWav(rawBuffer, sampleRate);
            audioMime = 'audio/wav';
          } else {
            audioBuffer = rawBuffer;
            if (audioPart.inlineData.mimeType) {
              audioMime = audioPart.inlineData.mimeType;
            }
          }
          break;
        }
      } catch (modelErr) {
        console.warn(`Gemini TTS attempt on ${model} failed:`, modelErr.message);
      }
    }

    // Must be larger than a 44-byte WAV header alone to be playable audio
    if (audioBuffer && audioBuffer.length > 44) {
      res.set('Content-Type', audioMime);
      return res.send(audioBuffer);
    }

    // If external model didn't return audio, signal client to use browser speech synthesis
    console.warn('Gemini audio TTS returned no audio data. Falling back to browser speech synthesis.');
    return res.status(503).json({
      fallback: true,
      message: 'Gemini audio TTS unavailable, falling back to browser speech synthesis.',
    });
  } catch (err) {
    console.warn('Gemini TTS error:', err.message);
    return res.status(503).json({
      fallback: true,
      message: 'External TTS failed, falling back to browser speech synthesis.',
    });
  }
});

// Export helper utilities for test suite and modular use
exports.normalizeAudioMimeType = normalizeAudioMimeType;
exports.pcmToWav = pcmToWav;
exports.resolveApiKey = resolveApiKey;
exports.sanitizeTranscript = sanitizeTranscript;
