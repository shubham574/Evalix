const crypto = require('crypto');
const SessionMemory = require('./sessionMemory.model');
const env = require('../../../config/env');

const MAX_RECENT_WINDOW = 6;
const MAX_SUMMARY_CHARS = 1500;
const MAX_KEY_CLAIMS = 25;

const initializeSessionMemory = async (session, blueprint, dbSession = null) => {
  const competencies = Array.isArray(blueprint.competencies) ? blueprint.competencies : [];
  const competencyCoverage = competencies.map((c) => ({
    competencyId: c.competencyId,
    competencyName: c.name || c.title || c.competencyId,
    questionsAsked: 0,
    followUpsAsked: 0,
    signalsObserved: [],
  }));

  const doc = {
    sessionId: session._id,
    snapshotVersion: 1,
    lastTurnNumber: 0,
    rollingSummary: `Interview started for ${blueprint.targetRole || session.targetRole} (${blueprint.seniorityLevel || session.seniorityLevel}).`,
    keyClaims: [],
    candidateTopicsMentioned: [],
    competencyCoverage,
    openFollowUpThreads: [],
    recentTurnWindow: [],
  };

  if (dbSession) {
    const created = await SessionMemory.create([doc], { session: dbSession });
    return created[0];
  }
  return SessionMemory.create(doc);
};

const getSessionMemory = async (sessionObjectId) => {
  return SessionMemory.findOne({ sessionId: sessionObjectId }).lean();
};

const updateSessionMemoryAfterTurn = async (
  sessionObjectId,
  {
    turnNumber,
    speaker,
    questionId = null,
    competencyId = null,
    spokenText = '',
    isFollowUp = false,
    isCoreQuestion = false,
    extractedClaims = [],
    topicsMentioned = [],
    observedSignals = [],
  },
  dbSession = null
) => {
  const memory = await SessionMemory.findOne({ sessionId: sessionObjectId }).session(
    dbSession || null
  );
  if (!memory) return null;

  const snippet = String(spokenText || '').trim().slice(0, 220);
  if (snippet) {
    memory.recentTurnWindow.push({
      turnNumber,
      speaker,
      questionId,
      textSnippet: snippet,
    });
    if (memory.recentTurnWindow.length > MAX_RECENT_WINDOW) {
      memory.recentTurnWindow = memory.recentTurnWindow.slice(-MAX_RECENT_WINDOW);
    }
  }

  for (const claim of extractedClaims || []) {
    const summary = String(claim?.summary || claim || '').trim();
    if (!summary) continue;
    memory.keyClaims.push({
      claimId: `clm_${crypto.randomBytes(4).toString('hex')}`,
      turnNumber,
      questionId,
      competencyId,
      summary: summary.slice(0, 240),
      technologies: Array.isArray(claim?.technologies)
        ? claim.technologies.slice(0, 8).map((t) => String(t).slice(0, 50))
        : [],
      verifiedByFollowUp: Boolean(isFollowUp),
    });
  }
  if (memory.keyClaims.length > MAX_KEY_CLAIMS) {
    memory.keyClaims = memory.keyClaims.slice(-MAX_KEY_CLAIMS);
  }

  const existingTopics = new Set(memory.candidateTopicsMentioned || []);
  for (const topic of topicsMentioned || []) {
    const clean = String(topic || '').trim().slice(0, 60);
    if (clean) existingTopics.add(clean);
  }
  memory.candidateTopicsMentioned = Array.from(existingTopics).slice(0, 40);

  if (competencyId) {
    let comp = memory.competencyCoverage.find((c) => c.competencyId === competencyId);
    if (!comp) {
      memory.competencyCoverage.push({
        competencyId,
        competencyName: competencyId,
        questionsAsked: 0,
        followUpsAsked: 0,
        signalsObserved: [],
      });
      comp = memory.competencyCoverage[memory.competencyCoverage.length - 1];
    }
    if (isCoreQuestion) comp.questionsAsked += 1;
    if (isFollowUp) comp.followUpsAsked += 1;
    if (Array.isArray(observedSignals) && observedSignals.length > 0) {
      const sigSet = new Set(comp.signalsObserved || []);
      for (const s of observedSignals) {
        const cleanSig = String(s || '').trim().slice(0, 100);
        if (cleanSig) sigSet.add(cleanSig);
      }
      comp.signalsObserved = Array.from(sigSet).slice(0, 15);
    }
  }

  memory.lastTurnNumber = Math.max(memory.lastTurnNumber || 0, turnNumber);
  const snapshotInterval = Math.max(1, env.INTERVIEW_ORCHESTRATOR_MEMORY_SNAPSHOT_INTERVAL);
  if (turnNumber % snapshotInterval === 0 || speaker === 'CANDIDATE') {
    const claimBits = memory.keyClaims
      .slice(-4)
      .map((c) => c.summary)
      .join('; ');
    const topicsBit = memory.candidateTopicsMentioned.slice(-8).join(', ');
    const nextSummary = [
      claimBits ? `Recent candidate points: ${claimBits}.` : '',
      topicsBit ? `Topics discussed: ${topicsBit}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, MAX_SUMMARY_CHARS);

    if (nextSummary) {
      memory.rollingSummary = nextSummary;
    }
    memory.snapshotVersion = (memory.snapshotVersion || 1) + 1;
  }

  await memory.save(dbSession ? { session: dbSession } : undefined);
  return memory.toObject();
};

const formatMemoryForPrompt = (memory) => {
  if (!memory) return { rollingSummary: '', keyClaims: [], recentTurns: [] };
  return {
    rollingSummary: memory.rollingSummary || '',
    keyClaims: (memory.keyClaims || []).slice(-6).map((c) => ({
      turnNumber: c.turnNumber,
      questionId: c.questionId,
      summary: c.summary,
      technologies: c.technologies,
    })),
    topicsMentioned: (memory.candidateTopicsMentioned || []).slice(-12),
    recentTurns: (memory.recentTurnWindow || []).slice(-MAX_RECENT_WINDOW),
  };
};

module.exports = {
  initializeSessionMemory,
  getSessionMemory,
  updateSessionMemoryAfterTurn,
  formatMemoryForPrompt,
};
