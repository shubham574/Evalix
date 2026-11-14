# EVALIX Module 5 — Live AI Interview Orchestration Engine

## Overview
Module 5 executes an approved Module 4 `InterviewBlueprint` (`status === 'READY'`) and conducts a structured, adaptive, voice-compatible live interview while preserving all existing STT/TTS integrations (`/api/transcribe`, `/api/live-interview`) and Modules 1–4 contracts.

## Existing Voice Architecture Integration
- **STT Reuse**: `voice/stt.adapter.js` wraps `services/elevenlabs.service.js` (`speechToText`, `scribe_v1`) and `controllers/transcription.controller.js` helpers (`normalizeAudioMimeType`, `sanitizeTranscript`) with Gemini multimodal transcription fallback (`gemini-2.5-flash`).
- **TTS Reuse**: `voice/tts.adapter.js` wraps `services/elevenlabs.service.js` (`textToSpeech`, `eleven_flash_v2_5`) with graceful browser-synthesis fallback (`fallbackToBrowser: true`) so `spokenText` is never lost if TTS fails and can be retried via `POST /api/v1/internal/interview-sessions/:sessionId/turns/:turnId/retry-tts` without re-calling the LLM.
- **Barge-In / Interruption**: `voice/interruption-handler.js` marks the interrupted AI turn (`interrupted: true`, `interruptedAtMs`) and logs `TTS_INTERRUPTED` without marking the current core question completed.
- **Partial & Empty Transcripts**: `PARTIAL` transcripts are ignored for LLM/state decisions (`ignored: true`); `EMPTY` transcripts trigger a gentle clarification prompt without advancing the core question queue.

## Architecture & Data Models
- `session/interviewSession.model.js` (`interview_sessions`): Session lifecycle (`CREATED -> READY -> IN_PROGRESS <-> PAUSED -> COMPLETED | ABANDONED | FAILED`), `blueprintChecksum`, `stateVersion` optimistic concurrency, `stageProgress`, `askedQuestionIds`, `completedQuestionIds`, `coveredCompetencyIds`, `followUpsPerQuestion`, and active/paused duration tracking.
- `turns/interviewTurn.model.js` (`interview_turns`): Immutable turn ledger with unique `{ sessionId, turnNumber }` and `{ sessionId, idempotencyKey }` indexes, STT/TTS metadata, and internal-only `adaptiveDecision` / `llmMetadata`.
- `memory/sessionMemory.model.js` (`interview_session_memory`): Compact persistent memory (`rollingSummary`, `keyClaims`, `candidateTopicsMentioned`, `competencyCoverage`, bounded 6-turn `recentTurnWindow`).
- `events/interviewEvent.model.js` (`interview_session_events`): Append-only audit & outbox event log emitting recoverable `INTERVIEW_SESSION_COMPLETED` (`outboxStatus: 'PENDING_DISPATCH'`) for Module 6.

## Security & Guardrails
- Candidate endpoints (`/api/v1/interview-intakes/:intakeId/interview-sessions`, `/api/v1/interview-sessions/*`) enforce `protect` + ownership verification (`session.userId === req.auth.userId`) and return candidate-safe serializers (`toCandidateSession`, `toCandidateTurn`) that strip private rubrics, internal adaptive reasoning, LLM metadata, and blueprint checksums.
- Internal orchestrator endpoints (`/api/v1/internal/interview-sessions/*`) require `x-internal-orchestrator-token` verified with `crypto.timingSafeEqual`.
- Candidate transcripts are isolated inside `<UNTRUSTED_CANDIDATE_TRANSCRIPT>` delimiters in `conversation/interviewer.agent.js`, and every LLM action proposal is validated by `adaptive/probe-validator.js` against Module 4 `followUpPolicies`, stage progression, duplicate-question prevention, and remaining time budgets.

## API Endpoints
### Candidate Endpoints
- `POST /api/v1/interview-intakes/:intakeId/interview-sessions`
- `POST /api/v1/interview-sessions/:sessionId/start`
- `POST /api/v1/interview-sessions/:sessionId/pause`
- `POST /api/v1/interview-sessions/:sessionId/resume`
- `POST /api/v1/interview-sessions/:sessionId/end`
- `POST /api/v1/interview-sessions/:sessionId/turns`
- `POST /api/v1/interview-sessions/:sessionId/interrupt`
- `GET /api/v1/interview-sessions/:sessionId`
- `GET /api/v1/interview-sessions/:sessionId/transcript`
- `GET /api/v1/interview-sessions/:sessionId/progress`

### Internal Orchestrator / Module 6 Endpoints
- `POST /api/v1/internal/interview-sessions/:sessionId/turns`
- `GET /api/v1/internal/interview-sessions/:sessionId/context`
- `POST /api/v1/internal/interview-sessions/:sessionId/complete`
- `POST /api/v1/internal/interview-sessions/:sessionId/interrupt`
- `POST /api/v1/internal/interview-sessions/:sessionId/turns/:turnId/retry-tts`
