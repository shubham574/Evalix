import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, defaultOptions, SLEEP_DURATION } from '../config.js';

export const options = defaultOptions;

export default function () {
  const res = http.get(`${BASE_URL}/api/mcqs`, {
    headers: defaultHeaders,
  });

  check(res, {
    'MCQs list status is 200': (r) => r.status === 200,
    'MCQs returns valid payload': (r) => {
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
