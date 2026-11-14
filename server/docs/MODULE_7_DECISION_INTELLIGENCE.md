# EVALIX Module 7 — Student Coaching & Interview Readiness Engine

## Overview

EVALIX is a **student-focused AI interview practice and preparation platform**.
Module 7 transforms completed mock-interview evaluations (Modules 3, 5, and 6) into:

1. **Student Interview Feedback & Practice Insights** (`StudentPracticeReport`)
2. **Answer Improvement Guidance** (structured answer coaching, STAR templates without fabricated experience, illustrative examples)
3. **Personalised Student Development Plans** (`CandidateDevelopmentPlan`) with practical exercises & practice questions
4. **Student Development Progress Tracking** (append-only `DevelopmentProgressEvent`)
5. **Longitudinal Improvement Across Attempts** (comparable-only practice history & competency trends)
6. **Internal Evaluation Quality & Calibration Monitoring** (`EvaluationQualityReport`, `EvaluationCalibrationObservation`, `EvaluationCalibrationSummary` — internal only, never exposed as candidate rankings)

## Practice Modes & Live Runtime Capability Status

- `REALISTIC_MOCK`: **Fully operational** in Module 5 live runtime and Module 7 post-session coaching.
- `GUIDED_PRACTICE`: **Metadata & longitudinal guardrails implemented in Module 7; live Module 5 runtime (hints/retries) NOT yet implemented** (creating a live session with `GUIDED_PRACTICE` returns `501`).
- `FOCUSED_SKILL_PRACTICE`: **Metadata & longitudinal guardrails implemented in Module 7; live Module 5 runtime (single-competency drill) NOT yet implemented** (creating a live session with `FOCUSED_SKILL_PRACTICE` returns `501`).

## Student-Facing API Contract (`/api/v1/`)

- `POST /api/v1/interview-sessions/:sessionId/learning-insights/generate`
- `GET /api/v1/interview-sessions/:sessionId/learning-insights`
- `GET /api/v1/interview-sessions/:sessionId/learning-insights/answers`
- `POST /api/v1/interview-sessions/:sessionId/development-plan/generate`
- `GET /api/v1/interview-sessions/:sessionId/development-plan`
- `POST /api/v1/development-plans/:planId/objectives/:objectiveId/progress`
- `GET /api/v1/development-plans/:planId/progress`
- `GET /api/v1/candidates/me/practice-history`
- `GET /api/v1/candidates/me/competency-progress`

All student endpoints require verified Clerk authentication (`protect`) and strict candidate ownership (`session.userId === req.auth.userId`).

## Internal Quality & Calibration Endpoints (`/api/v1/internal/`)

- `GET /api/v1/internal/evaluation-quality/sessions/:sessionId` (protected; blocked for students)
- `GET /api/v1/internal/evaluation-calibration/:organizationId` (protected; minimum sample threshold enforced; never ranks students)

## Deprecated Recruiter Hiring Workflows

- `RecruiterDecisionRecord` (`recruiter_decision_records`) and `DecisionSupportReport` (`recruiter_decision_support_reports`) are **deprecated** and removed from active student-facing APIs (`POST/GET .../recruiter-decisions`, `.../decision-support*`, `/api/v1/organizations/:organizationId/evaluation-calibration`).
- Historical database collections and records are **preserved untouched** for auditability.
