# EVALIX — Module 1: Candidate Intake & Profile Management Backend

## 1. Overview & Architecture

Module 1 implements the foundational candidate profile, experience, skills, projects, target job profile, secure document upload, and interview intake submission backend for **EVALIX**.

It integrates into the existing Express 5 + Mongoose 9 + Clerk (`@clerk/express`) backend under versioned `/api/v1/*` routes while keeping all existing `/api/*` routes (including Live Interview STT/TTS) untouched.

### Layered Responsibilities
- **Routes** (`*.routes.js`): Express routing, authentication (`protect`), Zod validation, Multer upload middleware.
- **Controllers** (`*.controller.js`): HTTP request/response mapping only (no business logic or DB queries).
- **Services** (`*.service.js`): Business rules, state transitions, transactions, storage orchestration, DTO mapping.
- **Repositories** (`*.repository.js`): Mongoose queries, bulk operations, pagination, ownership-scoped reads/writes.
- **Validation** (`*.validation.js`): Zod schemas + binary magic-byte document signature verification.

---

## 2. Database Entities & Relationships

All collections use UTC timestamps (`createdAt`, `updatedAt`) and are indexed on `userId` and `candidateProfileId`.

```
CandidateProfile (1) ──┬── (N) CandidateExperience
  [unique userId]      ├── (N) CandidateSkill       [unique (candidateProfileId, normalizedSkillName)]
                       ├── (N) CandidateProject
                       ├── (N) CandidateDocument    [unique storageKey; indexed checksum]
                       ├── (N) TargetJobProfile     ──> (0..1) CandidateDocument (JD)
                       └── (N) InterviewIntake      ──> (1) TargetJobProfile
                                                    ──> (0..1) CandidateDocument (Resume)
                                                    ──> (0..1) InterviewIntake (parentIntakeId)
```

### Collections
- `candidate_profiles`: Core candidate profile (`userId`, `fullName`, `email`, `phone`, `currentJobTitle`, `totalExperienceMonths`, `experienceLevel`, `professionalSummary`, `version`).
- `candidate_experiences`: Employment history (`companyName`, `jobTitle`, `employmentType`, `startDate`, `endDate`, `isCurrent`, `description`).
- `candidate_skills`: Normalized deduplicated skills (`skillName`, `normalizedSkillName`, `skillCategory`, `selfReportedProficiency`).
- `candidate_projects`: Candidate projects (`projectTitle`, `projectDescription`, `technologies`, `projectUrl`, `candidateResponsibility`).
- `candidate_documents`: Metadata for private `RESUME` / `JOB_DESCRIPTION` files (`originalFilename`, `storedFilename`, `mimeType`, `fileSize`, `storageProvider`, `storageKey`, `checksum`, `uploadStatus`, `processingStatus`, `securityStatus`, `retentionExpiresAt`).
- `target_job_profiles`: Target role, company, experience required, `jobDescriptionText`, `jobDescriptionDocumentId`, `jobLocation`, `jobType`.
- `interview_intakes`: Intake lifecycle (`DRAFT`, `READY_FOR_ANALYSIS`, `ANALYSIS_PENDING`, `COMPLETED`, `ARCHIVED`), `interviewPreferences`, `version`, `parentIntakeId`, `submittedAt`, `analysisEventPayload`.

Run idempotent index/collection migration:
```bash
npm run migrate
```

---

## 3. Authentication & Authorization

- All `/api/v1/*` endpoints require the existing `protect` middleware (`server/middleware/auth.js`), which derives `req.auth.userId` from Clerk's verified session.
- Client-supplied `userId` or `candidateProfileId` values are never trusted.
- Every repository read, update, delete, intake transition, and document download is scoped by `userId` to prevent IDOR and cross-candidate data access.

---

## 4. API Reference (`/api/v1`)

### Candidate Profile
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/candidates/profile` | Create candidate profile (409 if already exists) |
| `GET` | `/api/v1/candidates/profile` | Get profile, experiences, skills, projects, document metadata |
| `PUT` / `PATCH` | `/api/v1/candidates/profile` | Partial update (supports optimistic concurrency `expectedVersion`) |
| `POST` | `/api/v1/candidates/experiences` | Add employment experience |
| `DELETE` | `/api/v1/candidates/experiences/:experienceId` | Remove experience |
| `POST` | `/api/v1/candidates/skills` | Add/upsert single skill or `{ skills: [...] }` |
| `PATCH` | `/api/v1/candidates/skills/:skillId` | Update skill |
| `DELETE` | `/api/v1/candidates/skills/:skillId` | Delete skill |
| `POST` | `/api/v1/candidates/projects` | Add project |
| `PATCH` | `/api/v1/candidates/projects/:projectId` | Update project |
| `DELETE` | `/api/v1/candidates/projects/:projectId` | Delete project |

### Interview Intakes
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/interview-intakes` | Create `DRAFT` intake + `TargetJobProfile` |
| `GET` | `/api/v1/interview-intakes?page=1&limit=10&status=DRAFT` | Paginated list of candidate's intakes |
| `GET` | `/api/v1/interview-intakes/:intakeId` | Get detailed intake |
| `PATCH` | `/api/v1/interview-intakes/:intakeId` | Update `DRAFT` intake (`409` if already submitted) |
| `POST` | `/api/v1/interview-intakes/:intakeId/revisions` | Clone submitted intake into new `DRAFT` revision (`version + 1`) |
| `POST` | `/api/v1/interview-intakes/:intakeId/resume` | Upload resume (`multipart/form-data`, field: `resume`) |
| `POST` | `/api/v1/interview-intakes/:intakeId/job-description` | Upload JD doc (`multipart/form-data`, field: `jobDescription`) |
| `POST` | `/api/v1/interview-intakes/:intakeId/submit` | Validate completeness & transition to `READY_FOR_ANALYSIS` |

### Secure Documents
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/documents/:documentId/download-url` | Generate short-lived HMAC-signed download URL |
| `GET` | `/api/v1/documents/:documentId/download?expires=...&sig=...` | Stream private file (`X-Content-Type-Options: nosniff`) |
| `DELETE` | `/api/v1/documents/:documentId` | Soft-delete metadata & delete stored object |

#### Example: Create & Submit Intake
```json
// POST /api/v1/interview-intakes
{
  "targetJob": {
    "role": "Backend Developer",
    "company": "Example Company",
    "experienceRequired": "1-3 years",
    "jobDescription": "Build scalable Node.js and MongoDB backend services."
  },
  "interviewPreferences": {
    "interviewType": "MIXED",
    "durationMinutes": 45
  }
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "Interview intake created successfully",
  "data": {
    "intakeId": "6740...",
    "status": "DRAFT",
    "version": 1
  }
}
```

---

## 5. Resume & Document Security

- **Formats:** PDF (`.pdf`, `application/pdf`, `%PDF-` signature) and DOCX (`.docx`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `PK\x03\x04` + `[Content_Types].xml`/`word/` markers).
- **Private Storage:** Stored via `LocalPrivateStorageAdapter` under `DOCUMENT_STORAGE_PATH` (default `server/storage/private`, outside any Express static directory).
- **Streaming & Cleanup:** Multer writes to a private `.tmp` directory; SHA-256 checksums are computed via streams; identical uploads are deduplicated; if DB persistence fails, both temp and stored objects are deleted.
- **Malware Scanning:** When `MALWARE_SCAN_ENABLED=false`, `securityStatus` is explicitly recorded as `SIGNATURE_VERIFIED_NO_AV`.

---

## 6. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DOCUMENT_STORAGE_PROVIDER` | `local` | Storage backend (`local`; extensible to `s3`) |
| `DOCUMENT_STORAGE_PATH` | `./storage/private` | Private directory for uploaded files |
| `MAX_DOCUMENT_SIZE_BYTES` | `5242880` | Max upload size in bytes (5 MB) |
| `DOCUMENT_SIGNED_URL_TTL_SECONDS` | `300` | Signed download link lifetime in seconds |
| `DOCUMENT_RETENTION_DAYS` | `90` | Retention expiry window for documents |
| `DOCUMENT_SIGNING_SECRET` | `JWT_SECRET` fallback | HMAC secret for signed download URLs |
| `MALWARE_SCAN_ENABLED` | `false` | Enables/records AV scan status |

---

## 7. Error Codes Reference

| HTTP | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Zod schema validation failure |
| `400` | `EMPTY_DOCUMENT` / `FILE_TOO_LARGE` | Empty or oversized upload |
| `400` | `INVALID_DOCUMENT_FORMAT` / `INVALID_DOCUMENT_SIGNATURE` | Extension, MIME, or magic-byte mismatch |
| `400` | `RESUME_REQUIRED` / `JOB_DESCRIPTION_REQUIRED` | Missing required intake artifacts on submit |
| `401` | — | Unauthenticated request |
| `403` | `INVALID_SIGNED_URL` | Expired or tampered download signature |
| `404` | `CANDIDATE_PROFILE_NOT_FOUND` / `INTAKE_NOT_FOUND` / `DOCUMENT_NOT_FOUND` | Missing or unowned resource |
| `409` | `PROFILE_ALREADY_EXISTS` / `CONCURRENT_MODIFICATION` / `INTAKE_ALREADY_SUBMITTED` / `INVALID_STATE_TRANSITION` | Conflict or invalid state change |

---

## 8. Module 1 → Module 2 Integration Boundary

Module 1 **does not** parse resume text or run AI extraction. Upon `POST /api/v1/interview-intakes/:intakeId/submit`, Module 1 persists `status: "READY_FOR_ANALYSIS"` and emits on `intakeEventBus` (`server/modules/common/events/intakeEvents.js`):

```json
{
  "event": "INTERVIEW_INTAKE_SUBMITTED",
  "intakeId": "...",
  "candidateProfileId": "...",
  "resumeDocumentId": "...",
  "targetJobProfileId": "...",
  "jobDescriptionDocumentId": null,
  "submittedAt": "2026-11-15T01:20:00.000Z"
}
```

Module 2 (Resume & JD Intelligence Engine) will subscribe to `INTERVIEW_INTAKE_SUBMITTED` (or poll `READY_FOR_ANALYSIS` intakes), stream the private documents via `storage.adapter.js`, extract structured resume/JD fields, and transition the intake to `ANALYSIS_PENDING` / `COMPLETED`.
