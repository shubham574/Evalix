# EVALIX — Module 4: Intelligent Interview Blueprint Generator

## 1. Purpose & Scope
Module 4 transforms a reviewed **Module 3 `CandidateJobAnalysis`** (`READY_FOR_INTERVIEW_PLANNING`) and `InterviewIntake.interviewPreferences` into a structured, versioned, evidence-grounded `InterviewBlueprint` ready for the **Module 5 Live Interview Orchestration Engine**.

Module 4 does **not** execute live interviews, STT/TTS, or adaptive follow-ups.

---

## 2. Folder Structure

```text
server/modules/interview-blueprint/
|-- interview-blueprint.routes.js
|-- interview-blueprint.controller.js
|-- interview-blueprint.service.js
|-- interview-blueprint.repository.js
|-- models/
|   +-- interviewBlueprint.model.js
|-- templates/
|   +-- interview-template.registry.js
|-- planner/
|   |-- competency-planner.js
|   |-- stage-planner.js
|   +-- blueprint-orchestrator.js
|-- question-engine/
|   |-- question.schema.js
|   +-- question-generator.js
|-- assessment/
|   |-- rubric.schema.js
|   +-- rubric-generator.js
|-- validation/
|   +-- blueprint.validator.js
|-- serializers/
|   +-- blueprint.serializer.js
+-- jobs/
    |-- blueprintJob.model.js
    |-- blueprint-job.repository.js
    +-- blueprint.worker.js
```

---

## 3. REST API Endpoints (`/api/v1/interview-intakes/:intakeId/interview-blueprints`)

Candidate-facing endpoints require Clerk `protect` + intake ownership and serialize via `toCandidateFacingBlueprint` / `toCandidateFacingQuestions` (stripping rubrics, misconceptions, and follow-up trigger rules):

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/generate` | Candidate (`protect`) | Validate Module 3 readiness & enqueue/reuse blueprint job |
| `POST` | `/regenerate` | Candidate (`protect` + rate-limited) | Create a new blueprint version (blocked if locked for active session) |
| `GET` | `/status` | Candidate (`protect`) | Blueprint & worker job status |
| `GET` | `/current` | Candidate (`protect`) | Latest `READY`/`NEEDS_REVIEW` candidate-facing blueprint |
| `GET` | `/history` | Candidate (`protect`) | Version history & `sourceVersions` |
| `GET` | `/:blueprintId` | Candidate (`protect`) | Specific candidate-facing blueprint |
| `GET` | `/:blueprintId/questions` | Candidate (`protect`) | Candidate-visible questions only |
| `GET` | `/api/v1/internal/interview-intakes/:intakeId/interview-blueprints/:blueprintId` | Internal (`x-internal-orchestrator-token`) | Full Module 5 orchestrator contract |

---

## 4. Module 5 Integration Contract (Interview Orchestration Engine)

`GET /api/v1/internal/interview-intakes/:intakeId/interview-blueprints/:blueprintId` returns:
- `blueprintId`, `blueprintVersion`, `intakeId`, `candidateProfileId`, `candidateAnalysisId`, `status`, `isLockedForSession`
- `interviewType`, `targetRole`, `roleFamily`, `seniorityLevel`, `totalDurationSeconds`
- `competencies`, `excludedRequirements`
- `stages` (ordered, with `durationSeconds`, `plannedQuestionIds`, `completionCriteria`, `minimumEvidenceRequirements`)
- `coreQuestions`, `personalisedQuestions`, `questionPlan`
- `followUpPolicies` (keyed by `questionId`: `maxFollowUps`, `followUpBudgetSeconds`, `triggerCondition`, `allowedProbeTypes`)
- `evaluationRubrics` (5-point scale `1..5`, competency-specific descriptors, `expectedEvidence`, `criticalMisconceptions`, `partialCreditGuidance`) & `rubricReferences`
- `stageCompletionConditions`, `sourceVersions`, `planningConfigurationVersion`, `promptVersions`, `modelMetadata`
