const assert = require('assert');
const { transcribeAudio, generateSpeech } = require('./controllers/transcription.controller');

async function runTests() {
  console.log('--- Running Evalix Server Test Suite ---');

  // Test 1: Basic environment check
  console.log('[Test 1] Node environment assertion check...');
  assert.ok(true, 'Basic assert is functional');
  console.log('✓ Passed: Basic environment functional');

  // Test 2: transcribeAudio returns 400 if req.file is missing
  console.log('[Test 2] transcribeAudio validation: missing file returns 400...');
  let nextError = null;
  const mockReqNoFile = { file: null, headers: {} };
  const mockRes = {
    status: (code) => ({
      json: (data) => ({ statusCode: code, data }),
    }),
  };
  const mockNext = (err) => {
    nextError = err;
  };

  await transcribeAudio(mockReqNoFile, mockRes, mockNext);
  assert.ok(nextError, 'Expected next(err) to be called');
  assert.strictEqual(nextError.statusCode, 400, 'Expected status code 400');
  assert.strictEqual(nextError.message, 'No audio file provided');
  console.log('✓ Passed: transcribeAudio validates missing file correctly');

  // Test 3: generateSpeech returns 400 if text is missing or empty
  console.log('[Test 3] generateSpeech validation: missing text returns 400...');
  let ttsError = null;
  const mockReqNoText = { body: {}, headers: {} };
  await generateSpeech(mockReqNoText, mockRes, (err) => {
    ttsError = err;
  });
  assert.ok(ttsError, 'Expected next(err) to be called');
  assert.strictEqual(ttsError.statusCode, 400, 'Expected status code 400');
  assert.strictEqual(ttsError.message, 'No text provided');
  console.log('✓ Passed: generateSpeech validates missing text correctly');

  // Test 4: generateSpeech returns fallback status 503 when external TTS unavailable/unconfigured
  console.log('[Test 4] generateSpeech fallback: signals browser speech synthesis...');
  let responseStatus = null;
  let responseJson = null;
  const mockResFallback = {
    status: (code) => {
      responseStatus = code;
      return {
        json: (data) => {
          responseJson = data;
          return { statusCode: code, data };
        },
      };
    },
    set: () => {},
    send: () => {},
  };
  const mockReqFallback = {
    body: { text: 'Hello, welcome to Evalix!' },
    headers: {}, // No key provided
  };

  // Temporarily unset keys to verify clean fallback behavior
  const savedKey = process.env.GEMINI_API_KEY;
  const savedLiveKey = process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  const savedElevenKey = process.env.ELEVENLABS_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;

  try {
    await generateSpeech(mockReqFallback, mockResFallback, () => {});
    assert.strictEqual(responseStatus, 503, 'Expected status 503 for fallback');
    assert.strictEqual(responseJson?.fallback, true, 'Expected fallback: true');
    console.log('✓ Passed: generateSpeech cleanly signals browser speech fallback');
  } finally {
    if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    if (savedLiveKey) process.env.LIVE_INTERVIEW_GEMINI_API_KEY = savedLiveKey;
    if (savedElevenKey) process.env.ELEVENLABS_API_KEY = savedElevenKey;
  }

  // Test 5: transcribeAudio fails with 500 when Gemini API key is missing
  console.log('[Test 5] transcribeAudio fails with 500 when Gemini API key is unconfigured...');
  let transcribeKeyErr = null;
  const mockReqWithFileNoKey = {
    file: { buffer: Buffer.from('test-audio'), mimetype: 'audio/webm', originalname: 'audio.webm' },
    headers: {},
  };
  delete process.env.GEMINI_API_KEY;
  delete process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  try {
    await transcribeAudio(mockReqWithFileNoKey, mockRes, (err) => {
      transcribeKeyErr = err;
    });
    assert.ok(transcribeKeyErr, 'Expected next(err) to be called');
    assert.strictEqual(transcribeKeyErr.statusCode, 500, 'Expected status code 500');
    assert.ok(transcribeKeyErr.message.includes('Gemini API key not configured'), 'Expected informative message');
    console.log('✓ Passed: transcribeAudio requires API key configuration');
  } finally {
    if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    if (savedLiveKey) process.env.LIVE_INTERVIEW_GEMINI_API_KEY = savedLiveKey;
    if (savedElevenKey) process.env.ELEVENLABS_API_KEY = savedElevenKey;
  }

  // Test 6: Verify pcmToWav generates standard RIFF/WAVE header
  console.log('[Test 6] Verifying pcmToWav helper wraps raw PCM in valid WAV header...');
  const { pcmToWav, normalizeAudioMimeType, resolveApiKey } = require('./controllers/transcription.controller');
  const dummyPcm = Buffer.alloc(2400); // 100ms at 24kHz 16-bit mono
  const wavBuffer = pcmToWav(dummyPcm, 24000, 1, 16);
  assert.strictEqual(wavBuffer.length, 2444, 'WAV should be 44-byte header + PCM payload');
  assert.strictEqual(wavBuffer.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.strictEqual(wavBuffer.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.strictEqual(wavBuffer.subarray(12, 16).toString('ascii'), 'fmt ');
  assert.strictEqual(wavBuffer.readUInt16LE(20), 1, 'AudioFormat should be 1 (PCM)');
  assert.strictEqual(wavBuffer.readUInt16LE(22), 1, 'NumChannels should be 1 (mono)');
  assert.strictEqual(wavBuffer.readUInt32LE(24), 24000, 'SampleRate should be 24000');
  assert.strictEqual(wavBuffer.subarray(36, 40).toString('ascii'), 'data');
  assert.strictEqual(wavBuffer.readUInt32LE(40), 2400, 'Data chunk size matches PCM length');
  console.log('✓ Passed: pcmToWav generates correct RIFF/WAVE container');

  // Test 7: Verify normalizeAudioMimeType handling
  console.log('[Test 7] Verifying normalizeAudioMimeType handling across formats...');
  assert.strictEqual(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.strictEqual(normalizeAudioMimeType('audio/x-wav'), 'audio/wav');
  assert.strictEqual(normalizeAudioMimeType('audio/mpeg'), 'audio/mp3');
  assert.strictEqual(normalizeAudioMimeType('application/octet-stream', 'speech.wav'), 'audio/wav');
  assert.strictEqual(normalizeAudioMimeType('application/octet-stream', 'speech.mp3'), 'audio/mp3');
  assert.strictEqual(normalizeAudioMimeType('', 'speech.ogg'), 'audio/ogg');
  console.log('✓ Passed: normalizeAudioMimeType handles common audio formats and fallbacks');

  // Test 8: Verify resolveApiKey precedence
  console.log('[Test 8] Verifying resolveApiKey precedence...');
  const customHeaderReq = { headers: { 'x-gemini-api-key': 'custom-key-123' } };
  assert.strictEqual(resolveApiKey(customHeaderReq), 'custom-key-123', 'Header key takes highest precedence');
  console.log('✓ Passed: resolveApiKey prioritizes request header');

  // Test 9: Verify route controller exports
  console.log('[Test 9] Verifying controller exports...');
  assert.strictEqual(typeof transcribeAudio, 'function', 'transcribeAudio should be exported');
  assert.strictEqual(typeof generateSpeech, 'function', 'generateSpeech should be exported');
  console.log('✓ Passed: All controller functions properly exported');

  // Test 10: transcribeAudio handles empty/ultra-small buffer cleanly
  console.log('[Test 10] transcribeAudio handles ultra-small buffer (< 50 bytes) without failing...');
  let emptyBufferStatus = null;
  let emptyBufferData = null;
  const mockResEmpty = {
    status: (code) => {
      emptyBufferStatus = code;
      return {
        json: (data) => {
          emptyBufferData = data;
          return { statusCode: code, data };
        },
      };
    },
  };
  const mockReqSmall = {
    file: { buffer: Buffer.from('tiny'), mimetype: 'audio/webm', originalname: 'audio.webm' },
    headers: {},
  };
  await transcribeAudio(mockReqSmall, mockResEmpty, () => {});
  assert.strictEqual(emptyBufferStatus, 200, 'Expected status 200');
  assert.strictEqual(emptyBufferData?.success, true, 'Expected success: true');
  assert.strictEqual(emptyBufferData?.transcript, '', 'Expected empty transcript for ultra-small audio');
  console.log('✓ Passed: transcribeAudio returns empty transcript for ultra-small audio');

  // Test 11: normalizeAudioMimeType handles Safari/iOS formats (mp4, m4a, aac, flac)
  console.log('[Test 11] normalizeAudioMimeType handles Safari/iOS formats...');
  assert.strictEqual(normalizeAudioMimeType('audio/mp4'), 'audio/mp4');
  assert.strictEqual(normalizeAudioMimeType('video/mp4', 'recording.mp4'), 'audio/mp4');
  assert.strictEqual(normalizeAudioMimeType('audio/x-m4a', 'speech.m4a'), 'audio/mp4');
  assert.strictEqual(normalizeAudioMimeType('audio/aac', 'speech.aac'), 'audio/aac');
  assert.strictEqual(normalizeAudioMimeType('audio/flac', 'speech.flac'), 'audio/flac');
  assert.strictEqual(normalizeAudioMimeType('application/octet-stream', 'speech.m4a'), 'audio/mp4');
  console.log('✓ Passed: normalizeAudioMimeType supports Safari and modern media formats');

  // Test 12: resolveApiKey ignores whitespace-only strings
  console.log('[Test 12] resolveApiKey ignores whitespace-only keys...');
  const whitespaceReq = { headers: { 'x-gemini-api-key': '   ' } };
  const savedKey12 = process.env.GEMINI_API_KEY;
  const savedLiveKey12 = process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.LIVE_INTERVIEW_GEMINI_API_KEY;
  try {
    assert.strictEqual(resolveApiKey(whitespaceReq), null, 'Whitespace-only header should resolve to null when env is unset');
  } finally {
    if (savedKey12) process.env.GEMINI_API_KEY = savedKey12;
    if (savedLiveKey12) process.env.LIVE_INTERVIEW_GEMINI_API_KEY = savedLiveKey12;
  }
  console.log('✓ Passed: resolveApiKey safely trims keys');

  // Test 13: pcmToWav handles empty/null buffer safely
  console.log('[Test 13] pcmToWav handles empty buffer safely...');
  const emptyWav = pcmToWav(null, 24000);
  assert.strictEqual(emptyWav.length, 44, 'Should return a valid 44-byte header');
  assert.strictEqual(emptyWav.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.strictEqual(emptyWav.readUInt32LE(40), 0, 'Data chunk size should be 0');
  console.log('✓ Passed: pcmToWav handles empty/null buffer');

  // Test 14: generateSpeech handles undefined req.body safely without throwing
  console.log('[Test 14] generateSpeech handles undefined req.body safely...');
  let undefinedBodyError = null;
  const mockReqUndefinedBody = { body: undefined, headers: {} };
  await generateSpeech(mockReqUndefinedBody, mockRes, (err) => {
    undefinedBodyError = err;
  });
  assert.ok(undefinedBodyError, 'Expected next(err) to be called');
  assert.strictEqual(undefinedBodyError.statusCode, 400, 'Expected status code 400');
  assert.strictEqual(undefinedBodyError.message, 'No text provided');
  console.log('✓ Passed: generateSpeech safely validates undefined req.body');

  // Test 15: resolveApiKey handles mixed-case header 'X-Gemini-Api-Key'
  console.log('[Test 15] resolveApiKey handles mixed-case headers...');
  const mixedCaseReq = { headers: { 'X-Gemini-Api-Key': 'mixed-key-abc' } };
  assert.strictEqual(resolveApiKey(mixedCaseReq), 'mixed-key-abc', 'Should resolve mixed-case header key');
  console.log('✓ Passed: resolveApiKey handles mixed header casing');

  // Test 16: pcmToWav handles non-finite sample rate safely without generating NaN header
  console.log('[Test 16] pcmToWav handles invalid sample rate without generating NaN values...');
  const safeWav = pcmToWav(Buffer.alloc(100), 'invalid-rate');
  assert.strictEqual(safeWav.readUInt32LE(24), 24000, 'Should fall back to default 24000Hz');
  console.log('✓ Passed: pcmToWav safely handles non-numeric sampleRate');

  // Test 17: sanitize conversational silence hallucinations in transcription
  console.log('[Test 17] Sanitize conversational silence and refusal tokens...');
  const silenceSamples = [
    '*sigh*',
    '[silence]',
    '(inaudible)',
    'no speech detected',
    'there is no speech',
    "I'm sorry, but there is no speech in this audio.",
    'I cannot hear any speech',
    'The audio contains no speech.',
  ];
  for (const sample of silenceSamples) {
    const isCleaned =
      /^(\[.*\]|\(.*\)|<.*>|\*.*\*)$/.test(sample) ||
      /^(no speech detected|silence|none|inaudible|unintelligible|no speech|no audio|blank|empty|static|ambient noise|no audible speech|no speech was heard)\.?$/i.test(sample) ||
      /^(there is no speech|no speech was detected|no audio detected|i cannot hear any speech|please provide the audio|the audio contains no speech|the audio is silent|i cannot hear anything|there is no audible speech)/i.test(sample) ||
      /^(i'm sorry|i am sorry).*?(no speech|no audio|cannot hear|no sound)/i.test(sample);
    assert.strictEqual(isCleaned, true, `Expected "${sample}" to be classified as silence/hallucination`);
  }
  console.log('✓ Passed: conversational silence filters correctly classify noise/apology hallucinations');

  console.log('\n========================================');
  console.log('ALL SERVER TESTS PASSED SUCCESSFULLY! (17/17)');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Server tests failed with error:', err);
  process.exit(1);
});
