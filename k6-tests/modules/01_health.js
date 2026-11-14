import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultOptions, SLEEP_DURATION } from '../config.js';

export const options = defaultOptions;

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    'Health check status is 200': (r) => r.status === 200,
    'Server is reported running': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'success' && body.message === 'Server is running';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(SLEEP_DURATION);
}
