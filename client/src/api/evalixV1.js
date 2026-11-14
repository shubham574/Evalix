import api from './axios';
import { API } from './endpoints';

const unwrap = (res) => res?.data?.data ?? res?.data;

export const evalixV1 = {
  // Module 1: Candidate Profile & Intakes
  getProfile: async () => unwrap(await api.get(API.V1.CANDIDATES.PROFILE)),
  createProfile: async (payload) => unwrap(await api.post(API.V1.CANDIDATES.PROFILE, payload)),
  updateProfile: async (payload) => unwrap(await api.put(API.V1.CANDIDATES.PROFILE, payload)),

  listIntakes: async () => unwrap(await api.get(API.V1.INTAKES.LIST)),
  createIntake: async (payload) => unwrap(await api.post(API.V1.INTAKES.CREATE, payload)),
  getIntake: async (intakeId) => unwrap(await api.get(API.V1.INTAKES.GET(intakeId))),
  uploadResume: async (intakeId, file) => {
    const fd = new FormData();
    fd.append('resume', file);
    return unwrap(await api.post(API.V1.INTAKES.UPLOAD_RESUME(intakeId), fd));
  },
  uploadJobDescription: async (intakeId, file) => {
    const fd = new FormData();
    fd.append('jobDescription', file);
    return unwrap(await api.post(API.V1.INTAKES.UPLOAD_JD(intakeId), fd));
  },
  submitIntake: async (intakeId) => unwrap(await api.post(API.V1.INTAKES.SUBMIT(intakeId), {})),

  // Module 2: Document Intelligence
  getExtractionStatus: async (intakeId) =>
    unwrap(await api.get(API.V1.INTAKES.EXTRACTION_STATUS(intakeId))),
  retryExtraction: async (intakeId, documentType) =>
    unwrap(await api.post(API.V1.INTAKES.RETRY_EXTRACTION(intakeId), { documentType })),

  // Module 3: Candidate Intelligence
  analyzeCandidateIntelligence: async (intakeId) =>
    unwrap(await api.post(API.V1.INTAKES.ANALYZE(intakeId), {})),
  getAnalysisStatus: async (intakeId) =>
    unwrap(await api.get(API.V1.INTAKES.ANALYSIS_STATUS(intakeId))),
  getCompleteAnalysis: async (intakeId) =>
    unwrap(await api.get(API.V1.INTAKES.ANALYSIS_COMPLETE(intakeId))),

  // Module 4: Interview Blueprint
  generateBlueprint: async (intakeId, config = {}) =>
    unwrap(await api.post(API.V1.INTAKES.GENERATE_BLUEPRINT(intakeId), config)),
  getBlueprintStatus: async (intakeId) =>
    unwrap(await api.get(API.V1.INTAKES.BLUEPRINT_STATUS(intakeId))),
  getCurrentBlueprint: async (intakeId) =>
    unwrap(await api.get(API.V1.INTAKES.BLUEPRINT_CURRENT(intakeId))),

  // Module 5 & 8: Live Sessions (REALISTIC_MOCK, GUIDED_PRACTICE, FOCUSED_SKILL_PRACTICE)
  createSession: async (intakeId, payload) =>
    unwrap(await api.post(API.V1.INTAKES.CREATE_SESSION(intakeId), payload)),
  getSession: async (sessionId) => unwrap(await api.get(API.V1.SESSIONS.GET(sessionId))),
  startSession: async (sessionId, consentGranted = true) =>
    unwrap(await api.post(API.V1.SESSIONS.START(sessionId), { consentGranted })),
  pauseSession: async (sessionId) => unwrap(await api.post(API.V1.SESSIONS.PAUSE(sessionId), {})),
  resumeSession: async (sessionId) => unwrap(await api.post(API.V1.SESSIONS.RESUME(sessionId), {})),
  endSession: async (sessionId, reason = 'CANDIDATE_ENDED') =>
    unwrap(await api.post(API.V1.SESSIONS.END(sessionId), { reason })),
  submitTurn: async (sessionId, payload) =>
    unwrap(await api.post(API.V1.SESSIONS.TURNS(sessionId), payload)),
  getTranscript: async (sessionId) => unwrap(await api.get(API.V1.SESSIONS.TRANSCRIPT(sessionId))),

  // Module 8: Guided Practice
  requestHint: async (sessionId, { questionId, idempotencyKey }) =>
    unwrap(await api.post(API.V1.SESSIONS.HINT(sessionId), { questionId, idempotencyKey })),
  submitPracticeAttempt: async (sessionId, payload) =>
    unwrap(await api.post(API.V1.SESSIONS.ATTEMPTS(sessionId), payload)),
  getPracticeFeedback: async (sessionId, questionId = null) =>
    unwrap(
      await api.get(API.V1.SESSIONS.FEEDBACK(sessionId), {
        params: questionId ? { questionId } : undefined,
      })
    ),
  prepareRetry: async (sessionId, questionId = null) =>
    unwrap(await api.post(API.V1.SESSIONS.RETRY(sessionId), questionId ? { questionId } : {})),
  continuePracticeQuestion: async (sessionId, idempotencyKey) =>
    unwrap(await api.post(API.V1.SESSIONS.CONTINUE(sessionId), { idempotencyKey })),

  // Module 6: Evaluation & Report
  requestEvaluation: async (sessionId) =>
    unwrap(await api.post(API.V1.SESSIONS.REQUEST_EVALUATION(sessionId), {})),
  getEvaluationStatus: async (sessionId) =>
    unwrap(await api.get(API.V1.SESSIONS.EVALUATION_STATUS(sessionId))),
  getEvaluationReport: async (sessionId) =>
    unwrap(await api.get(API.V1.SESSIONS.REPORT(sessionId))),

  // Module 7: Student Coaching, Development Plan & Longitudinal Progress
  generateLearningInsights: async (sessionId) =>
    unwrap(await api.post(API.V1.SESSIONS.GENERATE_INSIGHTS(sessionId), {})),
  getLearningInsights: async (sessionId) =>
    unwrap(await api.get(API.V1.SESSIONS.GET_INSIGHTS(sessionId))),
  generateDevelopmentPlan: async (sessionId) =>
    unwrap(await api.post(API.V1.SESSIONS.GENERATE_PLAN(sessionId), {})),
  getDevelopmentPlan: async (sessionId) =>
    unwrap(await api.get(API.V1.SESSIONS.GET_PLAN(sessionId))),
  updateObjectiveProgress: async (planId, objectiveId, payload) =>
    unwrap(await api.post(API.V1.DEVELOPMENT_PLANS.UPDATE_PROGRESS(planId, objectiveId), payload)),
  getMyPracticeHistory: async (params = {}) =>
    unwrap(await api.get(API.V1.CANDIDATES.PRACTICE_HISTORY, { params })),
  getMyCompetencyProgress: async (params = {}) =>
    unwrap(await api.get(API.V1.CANDIDATES.COMPETENCY_PROGRESS, { params })),
};
