import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, defaultOptions, SLEEP_DURATION } from '../config.js';

export const options = defaultOptions;

export default function () {
  const payload = JSON.stringify({
    text: 'Hello, welcome to Evalix load testing session.',
  });

  const res = http.post(`${BASE_URL}/api/transcribe/tts`, payload, {
    headers: defaultHeaders,
  });

  // 200 = Success (TTS generated), 503 = Graceful fallback to client-side speech synthesis
  check(res, {
    'TTS endpoint responds with 200 or fallback 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(SLEEP_DURATION);
}
