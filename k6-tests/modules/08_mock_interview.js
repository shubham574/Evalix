import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, defaultOptions, SLEEP_DURATION } from '../config.js';

export const options = defaultOptions;

export default function () {
  const res = http.get(`${BASE_URL}/api/mock-interview`, {
    headers: defaultHeaders,
  });

  check(res, {
    'Mock interviews status is 200': (r) => r.status === 200,
    'Mock interviews returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(SLEEP_DURATION);
}
