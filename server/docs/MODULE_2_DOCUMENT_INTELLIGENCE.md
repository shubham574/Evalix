# EVALIX — Module 2: Resume & Job Description Intelligence Engine

## 1. Purpose & Scope
Module 2 transforms raw uploaded candidate resumes and target job descriptions (PDF & DOCX) into structured, evidence-backed, versioned JSON intelligence stored in MongoDB.

**Strict Scope Boundary:** Module 2 performs independent document understanding only. Candidate-job matching, competency gap analysis, scoring, question generation, and interview planning belong to **Module 3+**.

---

## 2. Module Layout

```text
server/modules/document-intelligence/
|-- parsers/
|   |-- text.normalizer.js        # Unicode normalization, control-char stripping, heading detection
|   |-- ocr.adapter.js            # OCR interface (NullOcrAdapter -> OCR_REQUIRED for scanned PDFs)
|   |-- pdf.parser.js             # Page-by-page PDF extraction, encryption & page-limit guards
|   |-- docx.parser.js            # Bounded-stream DOCX XML parser (headings, lists, tables, ZIP-bomb guard)
|   +-- parser.factory.js         # Mime-type dispatch -> DocumentParseResult
|-- providers/
|   +-- llm.provider.js           # @google/genai structured JSON wrapper + Mock/DI support
|-- evidence/
|   +-- evidence-validator.js     # Deterministic verification of quotes, documentId, blockId & page/paragraph refs
|-- extraction/
|   |-- extraction.schema.js      # Shared EvidenceItemSchema, ConfidenceEnum, Schema/Extractor versions
|   |-- chunker.js                # Token-budget section chunker for large documents
|   |-- documentExtraction.model.js
|   |-- intakeIntelligenceRun.model.js
|   |-- extraction.repository.js
|   +-- extraction-orchestrator.js
|-- resume/
|   |-- resume.schema.js          # ResumeIntelligenceDataSchema (v1.0)
|   |-- resume.prompt.js          # Prompt-injection-delimited resume prompt
|   +-- resume-extractor.js
|-- job-description/
|   |-- jd.schema.js              # JobDescriptionIntelligenceDataSchema (v1.0)
|   |-- jd.prompt.js              # Prompt-injection-delimited JD prompt
|   +-- jd-extractor.js
|-- jobs/
|   |-- extractionJob.model.js
|   |-- extraction-job.repository.js
|   +-- extraction.worker.js      # Event listener, startup reconciliation, atomic lease claiming & retry
|-- document-intelligence.service.js
|-- document-intelligence.controller.js
+-- document-intelligence.routes.js
```

---

## 3. Extraction Pipeline & Failure Handling

1. **Intake Trigger:** `INTERVIEW_INTAKE_SUBMITTED` emitted by Module 1's `intakeEventBus` triggers `enqueueIntakeIntelligence(intakeId)`.
2. **Startup Reconciliation:** On server boot, `ExtractionWorker.start()` calls `reconcilePendingIntakes()` to enqueue any `READY_FOR_ANALYSIS` intakes that lack an `IntakeIntelligenceRun` (recovering missed in-memory events across restarts).
3. **Atomic Job Claiming & Leases:** `claimNextJob()` uses MongoDB `findOneAndUpdate` to atomically claim `PENDING`, expired-due `RETRY_WAIT`, or expired-lease `PROCESSING` jobs (`lockedBy`, `leaseExpiresAt`).
4. **Checksum Idempotency:** Before calling the LLM, `extraction-orchestrator` checks `findCompletedByChecksum(...)` for `(documentId, checksumSha256, documentType, schemaVersion, extractorVersion, promptVersion)`.
5. **Security & Scan Gate:** Documents with `scanStatus === 'INFECTED'` are permanently rejected. `UNSCANNED` documents are blocked by default across staging, production, and other environments (`DOCUMENT_EXTRACTION_ALLOW_UNSCANNED=false`); local development must explicitly set `DOCUMENT_EXTRACTION_ALLOW_UNSCANNED=true`.
6. **Retries vs Terminal Failures:**
   - Permanent errors (`CORRUPTED_DOCUMENT`, `ENCRYPTED_DOCUMENT`, `EMPTY_DOCUMENT`, `DOCUMENT_PAGE_LIMIT_EXCEEDED`, `ZIP_EXPANSION_LIMIT_EXCEEDED`, `INFECTED_DOCUMENT`, `OCR_REQUIRED`, `UNSUPPORTED_DOCUMENT_TYPE`) mark the job `PERMANENT_FAILURE` (or `OCR_REQUIRED` where applicable).
   - Transient / LLM errors retry with exponential backoff up to `DOCUMENT_EXTRACTION_MAX_ATTEMPTS` before transitioning to `FAILED`.
   - `IntakeIntelligenceRun` aggregates both jobs into `PENDING`, `IN_PROGRESS`, `COMPLETED`, `PARTIALLY_COMPLETED`, or `FAILED`.

---

## 4. Evidence & Anti-Hallucination Model

Every factual claim carries an `evidence` array of `{ documentId, blockId, pageNumber, paragraphIndex, quote, matchConfidence }`.

`EvidenceValidator` enforces:
- `documentId` matches the processed document.
- `blockId` exists in the parsed document blocks.
- `pageNumber` (PDF) or `paragraphIndex` (DOCX) matches the referenced block.
- Normalized `quote` is a real substring of the referenced block text (normalized whitespace/punctuation).
- Claims failing verification are **downgraded to `matchConfidence: "UNVERIFIED"`** and recorded in `validationWarnings` rather than silently trusted.

---

## 5. REST API Endpoints (`/api/v1/interview-intakes/:intakeId/intelligence`)

All routes require Clerk `protect` authentication and verify `req.auth.userId` owns `:intakeId`.

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/intelligence` | Combined intelligence summary + job/run status |
| `GET` | `/intelligence/status` | Per-document job statuses, run state, and errors |
| `GET` | `/intelligence/resume` | Verified structured Resume Intelligence JSON |
| `GET` | `/intelligence/job-description` | Verified structured Job Description Intelligence JSON |
| `POST` | `/intelligence/retry` | Requeue `FAILED` extraction jobs for the intake |

---

## 6. Environment Configuration

- `DOCUMENT_EXTRACTION_WORKER_ENABLED` (default: `true`)
- `DOCUMENT_EXTRACTION_POLL_INTERVAL_MS` (default: `3000`)
- `DOCUMENT_EXTRACTION_LEASE_MS` (default: `60000`)
- `DOCUMENT_EXTRACTION_MAX_ATTEMPTS` (default: `3`)
- `DOCUMENT_EXTRACTION_MAX_PAGES` (default: `25`)
- `DOCUMENT_EXTRACTION_MAX_CHARACTERS` (default: `120000`)
- `DOCUMENT_EXTRACTION_MAX_DOCX_UNCOMPRESSED_BYTES` (default: `20971520`)
- `DOCUMENT_EXTRACTION_ALLOW_UNSCANNED` (default: `false` everywhere, including staging & production; set to `true` explicitly for local dev only)
- `DOCUMENT_EXTRACTION_MANUAL_RETRY_COOLDOWN_MS` (default: `60000`)
- `DOCUMENT_EXTRACTION_MANUAL_RETRY_RATE_WINDOW_MS` (default: `900000`)
- `DOCUMENT_EXTRACTION_MANUAL_RETRY_RATE_MAX` (default: `5`)
- `AI_EXTRACTION_MODEL` (default: `gemini-3.5-flash`)

---

## 7. Integration Contract for Module 3 (Matching & Gap Analysis)

Module 3 should consume `IntakeIntelligenceRun` (`status === 'COMPLETED' | 'PARTIALLY_COMPLETED'`) and load:
- `resumeExtractionId` -> `DocumentExtraction.structuredData` (`schemaVersion: "1.0"`)
- `jobDescriptionExtractionId` -> `DocumentExtraction.structuredData` (`schemaVersion: "1.0"`)
- Filter or down-weight any item whose `evidence` entries are `UNVERIFIED` or whose `extractionConfidence === 'INFERRED'` when building interview probes.
