// k6 configuration and shared constants for Evalix load testing
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
export const TEST_USER_ID = __ENV.TEST_USER_ID || 'test_user_loadtest';
export const SLEEP_DURATION = parseFloat(__ENV.SLEEP || '0.3');

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'x-test-user-id': TEST_USER_ID,
};

export const defaultOptions = {
  vus: 100,
  duration: '15s',
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1000ms
    http_req_failed: ['rate<0.05'],    // Error rate must stay below 5%
  },
};
