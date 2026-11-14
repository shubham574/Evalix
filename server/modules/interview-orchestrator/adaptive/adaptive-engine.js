const { validateAdaptiveProposal } = require('./probe-validator');
const { isOpeningOrGreetingStage } = require('../runtime/stage-manager');

const buildDeterministicFallbackDecision = ({
  session,
  currentStage,
  currentQuestion,
  nextQuestionCandidate,
  nextStageCandidate,
  timeSnapshot,
}) => {
  if (timeSnapshot.timeMode === 'TIME_EXPIRED') {
    return {
      action: 'WRAP_UP_INTERVIEW',
      followUpType: 'NONE',
      spokenResponse:
        'Thank you for sharing all of that. We have reached the end of our allocated time today. Thank you for participating in this interview!',
      reasoning: 'Deterministic wrap-up: session time budget expired.',
      fallbackUsed: true,
    };
  }

  if (isOpeningOrGreetingStage(currentStage) && !currentQuestion) {
    if (nextQuestionCandidate) {
      return {
        action: 'MOVE_NEXT_QUESTION',
        followUpType: 'NONE',
        spokenResponse: `Thank you! Let's begin. ${nextQuestionCandidate.prompt || nextQuestionCandidate.questionText}`,
        reasoning: 'Deterministic progression from opening stage to first question.',
        fallbackUsed: true,
      };
    }
    if (nextStageCandidate) {
      return {
        action: 'ADVANCE_STAGE',
        followUpType: 'NONE',
        spokenResponse: `Great, thank you! Let's move into ${nextStageCandidate.title}.`,
        reasoning: 'Deterministic stage advance from opening stage.',
        fallbackUsed: true,
      };
    }
  }

  if (nextQuestionCandidate && timeSnapshot.timeMode !== 'STAGE_BUDGET_EXCEEDED') {
    return {
      action: 'MOVE_NEXT_QUESTION',
      followUpType: 'NONE',
      spokenResponse: `Thank you for explaining that. Let's move to the next question: ${
        nextQuestionCandidate.prompt || nextQuestionCandidate.questionText
      }`,
      reasoning: 'Deterministic fallback to next blueprint question.',
      fallbackUsed: true,
    };
  }

  if (nextStageCandidate) {
    return {
      action: 'ADVANCE_STAGE',
      followUpType: 'NONE',
      spokenResponse: `Thank you. Let's transition to the next section: ${nextStageCandidate.title}.`,
      reasoning: 'Deterministic fallback to next interview stage.',
      fallbackUsed: true,
    };
  }

  return {
    action: 'WRAP_UP_INTERVIEW',
    followUpType: 'NONE',
    spokenResponse:
      'Thank you so much for your thoughtful responses today. That concludes our interview questions. Have a wonderful rest of your day!',
    reasoning: 'Deterministic wrap-up: all stages and questions completed.',
    fallbackUsed: true,
  };
};

const resolveAdaptiveDecision = ({
  agentResult,
  session,
  blueprint,
  currentStage,
  currentQuestion,
  nextQuestionCandidate,
  nextStageCandidate,
  followUpPolicy,
  timeSnapshot,
}) => {
  // Hard time-budget override: if session time expired, always wrap up cleanly
  if (timeSnapshot.timeMode === 'TIME_EXPIRED') {
    return {
      ...buildDeterministicFallbackDecision({
        session,
        currentStage,
        currentQuestion,
        nextQuestionCandidate,
        nextStageCandidate,
        timeSnapshot,
      }),
      policyValidated: true,
      candidateClaims: agentResult?.decision?.candidateClaims || [],
      topicsMentioned: agentResult?.decision?.topicsMentioned || [],
      observedSignals: agentResult?.decision?.observedSignals || [],
    };
  }

  if (agentResult?.ok && agentResult.decision) {
    const validation = validateAdaptiveProposal({
      proposedDecision: agentResult.decision,
      session,
      blueprint,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      followUpPolicy,
      timeSnapshot,
    });

    if (validation.valid) {
      return {
        action: agentResult.decision.action,
        followUpType: validation.normalizedFollowUpType,
        spokenResponse: agentResult.decision.spokenResponse,
        reasoning: agentResult.decision.reasoning,
        policyValidated: true,
        fallbackUsed: false,
        validationWarnings: validation.warnings,
        candidateClaims: agentResult.decision.candidateClaims || [],
        topicsMentioned: agentResult.decision.topicsMentioned || [],
        observedSignals: agentResult.decision.observedSignals || [],
      };
    }

    const fallback = buildDeterministicFallbackDecision({
      session,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      timeSnapshot,
    });

    return {
      ...fallback,
      policyValidated: true,
      validationWarnings: [...validation.warnings, `Rejected LLM action: ${validation.reason}`],
      candidateClaims: agentResult.decision.candidateClaims || [],
      topicsMentioned: agentResult.decision.topicsMentioned || [],
      observedSignals: agentResult.decision.observedSignals || [],
    };
  }

  const fallback = buildDeterministicFallbackDecision({
    session,
    currentStage,
    currentQuestion,
    nextQuestionCandidate,
    nextStageCandidate,
    timeSnapshot,
  });

  return {
    ...fallback,
    policyValidated: true,
    validationWarnings: agentResult?.error ? [agentResult.error] : [],
    candidateClaims: [],
    topicsMentioned: [],
    observedSignals: [],
  };
};

module.exports = {
  buildDeterministicFallbackDecision,
  resolveAdaptiveDecision,
};
