# EVALIX Module 6 — AI Interview Evaluation & Reporting Engine

## Module 5 -> Module 6 Data Contract
- **Session (`interview_sessions`)**: `sessionId`, `intakeId`, `candidateProfileId`, `blueprintId`, `blueprintVersion`, `blueprintChecksum`, `status` (`COMPLETED` | `ABANDONED`), `stageProgress`, `askedQuestionIds`, `completedQuestionIds`, `coveredCompetencyIds`, `activeDurationSeconds`, `terminationReason`.
- **Turns (`interview_turns`)**: `_id`, `sessionId`, `turnNumber`, `speaker` (`AI` | `CANDIDATE` | `SYSTEM`), `turnType`, `stageId`, `questionId`, `spokenText`, `rawTranscript`, `transcriptStatus` (`FINAL` | `CONFIRMED` | `PARTIAL` | `EMPTY`), `interrupted`.
- **Outbox Event (`interview_session_events`)**: `eventType: 'INTERVIEW_SESSION_COMPLETED'`, `outboxStatus: 'PENDING_DISPATCH'` -> marked `'DISPATCHED'` after evaluation completion.
- **Blueprint (`interview_blueprints`)**: Locked historical `blueprintVersion`, `competencyPlan`, `stages`, `questionPlan`, `evaluationRubrics`.

## Evaluation Architecture & Deterministic Scoring
1. **Validation & Assembly** (`assembly/`): Verifies terminal session status, exact `blueprintVersion` and `blueprintChecksum`, deduplicates turns, excludes `PARTIAL`/`EMPTY` candidate transcripts, and groups AI + candidate turns per question with prompting context (`UNPROMPTED`, `CLARIFICATION_SUPPORTED`, `HINT_SUPPORTED`, `INTERVIEWER_SUPPLIED`, `UNVERIFIABLE`).
2. **Rubric & Evidence Validation** (`rubric/`, `evidence/`, `evaluators/`): Evaluates each answered question against its exact Module 4 `evaluationRubrics` (1–5 scale). Deterministically verifies every LLM-cited `turnId` and verbatim quote against actual `CANDIDATE` turns; unverified quotes are rejected and lower `evidenceSupport`.
3. **Deterministic Aggregation** (`scoring/`):
   - Question statuses: `EVALUATED`, `PARTIALLY_EVALUATED`, `NOT_ASKED`, `NOT_ANSWERED`, `INTERRUPTED`, `INVALID_TRANSCRIPT`, `INSUFFICIENT_EVIDENCE`, `EXCLUDED_BY_SESSION_POLICY`.
   - Competency scores: weighted or equal-weight average of scored questions; `NOT_ASSESSED` competencies keep `score: null` (never 0).
   - Overall score: weighted average across assessed competencies ONLY when blueprint weights sum to 1 or 100 and `assessmentCoverage >= INTERVIEW_EVALUATION_MIN_COVERAGE_PERCENT`.
4. **Reports & Human Review** (`reporting/`, `interview-evaluation.service.js`): Separate candidate vs recruiter serializers (`candidateReport` hides numeric scores unless `INTERVIEW_EVALUATION_EXPOSE_CANDIDATE_SCORES=true`). Append-only `EvaluationReviewEvent` preserves original AI scores alongside `humanOverride`.
5. **Worker** (`jobs/evaluation.worker.js`): Consumes `INTERVIEW_SESSION_COMPLETED` outbox events via startup reconciliation, atomic lease claiming, bounded question batching (skipping already-evaluated questions on crash recovery), and exponential backoff retries.

## Module 7 Integration Contract
Provides stable read contracts for `InterviewEvaluationRun`, `QuestionEvaluation`, `CompetencyEvaluation`, `InterviewReport`, and `EvaluationReviewEvent` keyed by `sessionId` / `evaluationRunId` / `blueprintVersion`.
