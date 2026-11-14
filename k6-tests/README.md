# Grafana k6 Load Testing Suite - Evalix

This suite tests each module of the **Evalix** backend one by one under a load of **100 virtual users (VUs) for 15 seconds**.

---

## 📁 Structure

```text
k6-tests/
├── config.js               # Shared configuration (base URL, auth headers, thresholds)
├── all-modules.js          # Master k6 script (runs all 10 modules sequentially using k6 scenarios)
├── run-k6.ps1              # PowerShell runner that executes each module script one by one
├── run-k6.sh               # Bash runner for Linux / macOS / Git Bash
└── modules/
    ├── 01_health.js        # Module 1: System & DB Health (/api/health)
    ├── 02_dashboard.js     # Module 2: Dashboard Analytics (/api/dashboard/stats)
    ├── 03_history.js       # Module 3: History & Activity (/api/history)
    ├── 04_job_analysis.js  # Module 4: Job Analysis (/api/job-analysis)
    ├── 05_mcq.js           # Module 5: MCQ Sets (/api/mcqs)
    ├── 06_assessment.js    # Module 6: Assessments (/api/assessments)
    ├── 07_interview.js     # Module 7: Interview Questions (/api/interview)
    ├── 08_mock_interview.js# Module 8: Mock Interview Sessions (/api/mock-interview)
    ├── 09_live_interview.js# Module 9: Live Interview Sessions (/api/live-interview)
    └── 10_transcribe.js    # Module 10: Speech & Transcription (/api/transcribe/tts)
```

---

## 🚀 How to Run

### Prerequisite: Start the Server
Make sure the Evalix server is running on port 5000:
```powershell
cd server
npm run dev
# or: node server.js
```

---

### Option 1: PowerShell Runner (Recommended for Windows)
Executes each module script one after another and prints an execution summary table:

```powershell
# Run all modules (100 users, 15 seconds per module)
.\k6-tests\run-k6.ps1

# Run with custom parameters:
.\k6-tests\run-k6.ps1 -BaseUrl "http://localhost:5000" -Vus 100 -Duration "15s"

# Run only a specific module:
.\k6-tests\run-k6.ps1 -Module 01_health
.\k6-tests\run-k6.ps1 -Module 02_dashboard
```

---

### Option 2: Master k6 Scenario Runner
Runs all 10 modules sequentially within a single k6 process using staggered scenario start times (0s-15s, 15s-30s, etc.):

```powershell
k6 run k6-tests/all-modules.js
```

Or via npm from the `server` directory:
```powershell
cd server
npm run test:load
```

---

### Option 3: Run Any Single Module Directly with k6
You can run any module directly using standard k6 CLI commands:

```powershell
# Run health check module with 100 users for 15s
k6 run --vus 100 --duration 15s k6-tests/modules/01_health.js

# Run dashboard stats module
k6 run --vus 100 --duration 15s k6-tests/modules/02_dashboard.js

# Pass custom base URL or auth token
k6 run --vus 100 --duration 15s -e BASE_URL="http://localhost:5000" -e AUTH_TOKEN="your_jwt_token" k6-tests/modules/02_dashboard.js
```

---

## 🔐 Authentication in Load Tests

The protected modules (`dashboard`, `history`, `job-analysis`, `mcq`, etc.) use Clerk authentication.
To load-test smoothly without triggering external Clerk rate limits:
- The tests send a test authorization header: `Authorization: Bearer test-token` and `x-test-user-id: test_user_loadtest`.
- If you have an active Clerk user JWT from the frontend, pass it with:
  ```powershell
  k6 run -e AUTH_TOKEN="eyJhbG..." k6-tests/modules/02_dashboard.js
  ```

---

## ⏱️ Performance Thresholds

Each module is configured with:
- **100 Virtual Users (VUs)** concurrently executing requests.
- **15 seconds** test duration.
- **0.3s sleep** pause between iterations per user.
- **95th percentile latency threshold**: `p(95) < 1000ms`.
- **Failure rate threshold**: `rate < 5%`.
