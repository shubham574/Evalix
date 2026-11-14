# EVALIX — Module 3: Candidate Intelligence & Job Requirement Analysis Engine

## 1. Purpose & Scope
Module 3 connects **Module 1 (Candidate-Entered Data)** and **Module 2 (Validated Resume & JD Extractions)** into an evidence-backed, versioned candidate intelligence profile and requirement-level assessment without generating interview questions, hiring recommendations, or opaque overall scores.

---

## 2. Folder Structure

```text
server/modules/candidate-intelligence/
|-- candidate-intelligence.routes.js
|-- candidate-intelligence.controller.js
|-- candidate-intelligence.service.js
|-- analysis/
|   |-- analysis.schema.js
|   |-- analysis.repository.js
|   |-- analysis-orchestrator.js
|   |-- candidateJobAnalysis.model.js
|   +-- candidateRequirementAssessment.model.js
|-- candidate-profile/
|   |-- candidate-facts.service.js
|   +-- candidate-profile.builder.js
|-- job-requirements/
|   +-- requirement-normalizer.js
|-- matching/
|   |-- skill-alias.registry.js
|   |-- deterministic-matcher.js
|   |-- semantic-matcher.js
|   +-- experience-analyzer.js
|-- evidence/
|   +-- evidence-mapper.js
|-- candidate-review/
|   |-- candidateClaimReview.model.js
|   |-- candidate-review.repository.js
|   |-- candidate-review.validation.js
|   +-- candidate-review.service.js
+-- jobs/
    |-- analysisJob.model.js
    |-- analysis-job.repository.js
    +-- analysis.worker.js
```

---

## 3. REST API Endpoints (`/api/v1/interview-intakes/:intakeId/candidate-intelligence`)

All routes require Clerk `protect` authentication and verify `req.auth.userId` owns `:intakeId`.

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/analyze` | Validate Module 2 readiness and enqueue/reuse idempotent analysis job |
| `GET` | `/status` | Current analysis & background job status, version, and errors |
| `GET` | `/profile` | Canonical candidate profile with provenance & verification states |
| `GET` | `/requirements` | Paginated requirement-level assessments (`page`, `limit`, `requirementType`, `assessment`) |
| `GET` | `/` | Complete analysis snapshot, `experienceAnalysis`, `interviewFocusAreas`, & `sourceVersions` |
| `POST` | `/claims/:claimId/review` | Record versioned candidate review (`CONFIRM`, `CORRECT`, `DISPUTE`, `ADD_MISSING_INFORMATION`, `MARK_NOT_MINE`) |
| `GET` | `/reviews` | List candidate claim review history |
| `POST` | `/complete-review` | Build `reviewedProfileSnapshot` and transition status to `READY_FOR_INTERVIEW_PLANNING` |

---

## 4. Module 4 Integration Contract (Interview Blueprint Generator)

Module 4 should consume `CandidateJobAnalysis` where `analysisStatus === 'READY_FOR_INTERVIEW_PLANNING'` (or `AWAITING_CANDIDATE_REVIEW` when explicitly permitted):
1. `reviewedProfileSnapshot || candidateProfileSnapshot` — Canonical candidate facts with preserved `sourceType` (`RESUME_EXTRACTED`, `CANDIDATE_ENTERED`, `CANDIDATE_CONFIRMED`, `CANDIDATE_CORRECTED`).
2. `jobRequirementSnapshot` — Normalized requirements preserving `MUST_HAVE` vs `PREFERRED` vs `OPTIONAL`, categories, and `ambiguities`.
3. `CandidateRequirementAssessment[]` — Requirement-level `assessment` (`SUPPORTED_DIRECTLY`, `SUPPORTED_BY_TRANSFERABLE_EVIDENCE`, `PARTIALLY_SUPPORTED`, `NOT_EVIDENCED`, `CONFLICTING_EVIDENCE`, `REQUIRES_CANDIDATE_CONFIRMATION`, `NOT_APPLICABLE`), `candidateFactReferences`, and `evidenceReferences`.
4. `experienceAnalysis` — Conservative `derivedExperienceMonths`, `internshipMonths`, `reportedExperienceMonths`, and `derivationStatus`.
5. `interviewFocusAreas` — Competency identifiers and reasons for deeper probing.
6. `sourceVersions` — `resumeExtractionId`, `jobDescriptionExtractionId`, and schema versions for traceability.
