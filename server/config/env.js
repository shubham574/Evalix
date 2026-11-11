require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  LIVE_INTERVIEW_GEMINI_API_KEY: process.env.LIVE_INTERVIEW_GEMINI_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
