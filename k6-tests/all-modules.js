import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, SLEEP_DURATION } from './config.js';

export const options = {
  scenarios: {
    // Module 1: Health Check (0s - 15s)
    module_01_health: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '0s',
      exec: 'testHealth',
    },
    // Module 2: Dashboard (15s - 30s)
    module_02_dashboard: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '15s',
      exec: 'testDashboard',
    },
    // Module 3: History (30s - 45s)
    module_03_history: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '30s',
      exec: 'testHistory',
    },
    // Module 4: Job Analysis (45s - 60s)
    module_04_job_analysis: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '45s',
      exec: 'testJobAnalysis',
    },
    // Module 5: MCQs (60s - 75s)
    module_05_mcq: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '60s',
      exec: 'testMCQ',
    },
    // Module 6: Assessments (75s - 90s)
    module_06_assessment: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '75s',
      exec: 'testAssessment',
    },
    // Module 7: Interview Questions (90s - 105s)
    module_07_interview: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '90s',
      exec: 'testInterview',
    },
    // Module 8: Mock Interview (105s - 120s)
    module_08_mock_interview: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '105s',
      exec: 'testMockInterview',
    },
    // Module 9: Live Interview (120s - 135s)
    module_09_live_interview: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '120s',
      exec: 'testLiveInterview',
    },
    // Module 10: Transcription / TTS (135s - 150s)
    module_10_transcribe: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15s',
      startTime: '135s',
      exec: 'testTranscribe',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1000ms
    http_req_failed: ['rate<0.05'],    // Total error rate must stay below 5%
  },
};

// 1. Health Scenario
export function testHealth() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'Health: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 2. Dashboard Scenario
export function testDashboard() {
  const res = http.get(`${BASE_URL}/api/dashboard/stats`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Dashboard: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 3. History Scenario
export function testHistory() {
  const res = http.get(`${BASE_URL}/api/history`, {
    headers: defaultHeaders,
  });
  check(res, {
    'History: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 4. Job Analysis Scenario
export function testJobAnalysis() {
  const res = http.get(`${BASE_URL}/api/job-analysis`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Job Analysis: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 5. MCQ Scenario
export function testMCQ() {
  const res = http.get(`${BASE_URL}/api/mcqs`, {
    headers: defaultHeaders,
  });
  check(res, {
    'MCQs: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 6. Assessment Scenario
export function testAssessment() {
  const res = http.get(`${BASE_URL}/api/assessments`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Assessments: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 7. Interview Questions Scenario
export function testInterview() {
  const res = http.get(`${BASE_URL}/api/interview`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Interview: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 8. Mock Interview Scenario
export function testMockInterview() {
  const res = http.get(`${BASE_URL}/api/mock-interview`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Mock Interview: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 9. Live Interview Scenario
export function testLiveInterview() {
  const res = http.get(`${BASE_URL}/api/live-interview`, {
    headers: defaultHeaders,
  });
  check(res, {
    'Live Interview: status is 200': (r) => r.status === 200,
  });
  sleep(SLEEP_DURATION);
}

// 10. Transcription TTS Scenario
export function testTranscribe() {
  const payload = JSON.stringify({
    text: 'Load testing transcription module',
  });
  const res = http.post(`${BASE_URL}/api/transcribe/tts`, payload, {
    headers: defaultHeaders,
  });
  check(res, {
    'Transcribe TTS: responds 200 or 503': (r) => r.status === 200 || r.status === 503,
  });
  sleep(SLEEP_DURATION);
}
