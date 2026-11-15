const { validateAdaptiveProposal } = require('./probe-validator');
const { isOpeningOrGreetingStage } = require('../runtime/stage-manager');

const buildDeterministicFallbackDecision = ({
  session,
  currentStage,
  currentQuestion,
  nextQuestionCandidate,
  nextStageCandidate,
  timeSnapshot,
  classification = null,
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

  // 1. Repeat request
  if (classification?.intent === 'REQUEST_REPEAT' && currentQuestion) {
    return {
      action: 'CLARIFY_OR_REPEAT',
      followUpType: 'CLARIFICATION',
      spokenResponse: `Certainly! Here is the question again: ${currentQuestion.prompt || currentQuestion.questionText}`,
      reasoning: 'Candidate requested question repetition.',
      fallbackUsed: true,
    };
  }

  // 2. Pause request
  if (classification?.intent === 'REQUEST_PAUSE') {
    return {
      action: 'PAUSE_FOR_THINKING',
      followUpType: 'NONE',
      spokenResponse: 'Take all the time you need. Let me know whenever you are ready to continue.',
      reasoning: 'Candidate requested time to think.',
      fallbackUsed: true,
    };
  }

  // 3. Skip request
  if (classification?.intent === 'REQUEST_SKIP') {
    const nextQ = nextQuestionCandidate;
    if (nextQ) {
      return {
        action: 'MOVE_NEXT_QUESTION',
        followUpType: 'NONE',
        spokenResponse: `Understood, let's skip this question and move on: ${nextQ.prompt || nextQ.questionText}`,
        reasoning: 'Candidate explicitly skipped the question.',
        fallbackUsed: true,
      };
    }
    if (nextStageCandidate) {
      return {
        action: 'ADVANCE_STAGE',
        followUpType: 'NONE',
        spokenResponse: `Understood, let's move into our next section: ${nextStageCandidate.title}.`,
        reasoning: 'Candidate skipped last question in stage.',
        fallbackUsed: true,
      };
    }
    return {
      action: 'WRAP_UP_INTERVIEW',
      followUpType: 'NONE',
      spokenResponse: 'Understood. That concludes all questions for today. Thank you!',
      reasoning: 'Candidate skipped final question in interview.',
      fallbackUsed: true,
    };
  }

  // 4. Ambiguous negative response ("no")
  if (classification?.requiresClarification && classification?.intent === 'UNCLEAR') {
    return {
      action: 'CLARIFY_OR_REPEAT',
      followUpType: 'CLARIFICATION',
      spokenResponse:
        'No problem at all! Would you prefer to continue, skip this question, or pause the interview for a moment?',
      reasoning: 'Negative or unclear single-word reply requires clarification.',
      fallbackUsed: true,
    };
  }

  // 5. Off-topic response
  if (classification?.intent === 'OFF_TOPIC') {
    const target = currentQuestion
      ? currentQuestion.prompt || currentQuestion.questionText
      : 'the question';
    return {
      action: 'CLARIFY_OR_REPEAT',
      followUpType: 'CLARIFICATION',
      spokenResponse: `Could you please clarify how that relates to ${target}, or share your thoughts on that topic?`,
      reasoning: 'Candidate answer was classified as off-topic.',
      fallbackUsed: true,
    };
  }

  // 6. Conversational acknowledgement ("yes", "okay")
  if (classification?.intent === 'ACKNOWLEDGEMENT') {
    if (currentQuestion) {
      // Already on a question: prompt them to answer it
      return {
        action: 'CLARIFY_OR_REPEAT',
        followUpType: 'CLARIFICATION',
        spokenResponse: `Please go ahead and share your thoughts on: ${currentQuestion.prompt || currentQuestion.questionText}`,
        reasoning: 'Candidate acknowledged without providing an answer.',
        fallbackUsed: true,
      };
    }
    // On a stage announcement: present the first question of that stage
    if (nextQuestionCandidate) {
      return {
        action: 'MOVE_NEXT_QUESTION',
        followUpType: 'NONE',
        spokenResponse: `Great! Let's get started: ${nextQuestionCandidate.prompt || nextQuestionCandidate.questionText}`,
        reasoning: 'Candidate acknowledged section transition; presenting first question.',
        fallbackUsed: true,
      };
    }
    if (nextStageCandidate) {
      return {
        action: 'ADVANCE_STAGE',
        followUpType: 'NONE',
        spokenResponse: `Great, thank you! Let's move into ${nextStageCandidate.title}.`,
        reasoning: 'Stage advance after acknowledgement.',
        fallbackUsed: true,
      };
    }
  }

  // 7. Opening / greeting stage with no active question
  if (isOpeningOrGreetingStage(currentStage) && !currentQuestion) {
    if (nextQuestionCandidate) {
      return {
        action: 'MOVE_NEXT_QUESTION',
        followUpType: 'NONE',
        spokenResponse: `Thank you! Let's begin: ${nextQuestionCandidate.prompt || nextQuestionCandidate.questionText}`,
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

  // 8. Normal question progression
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
  classification = null,
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
        classification,
      }),
      policyValidated: true,
      candidateClaims: agentResult?.decision?.candidateClaims || [],
      topicsMentioned: agentResult?.decision?.topicsMentioned || [],
      observedSignals: agentResult?.decision?.observedSignals || [],
    };
  }

  // Hard intent overrides: repeat, pause, skip, and clarification MUST override speculative LLM advances
  if (
    classification &&
    ['REQUEST_REPEAT', 'REQUEST_PAUSE', 'REQUEST_SKIP', 'OFF_TOPIC'].includes(classification.intent)
  ) {
    const decision = buildDeterministicFallbackDecision({
      session,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      timeSnapshot,
      classification,
    });
    return {
      ...decision,
      policyValidated: true,
      candidateClaims: agentResult?.decision?.candidateClaims || [],
      topicsMentioned: agentResult?.decision?.topicsMentioned || [],
      observedSignals: agentResult?.decision?.observedSignals || [],
    };
  }

  // Disallow completing or advancing on simple acknowledgements
  if (classification?.intent === 'ACKNOWLEDGEMENT') {
    const decision = buildDeterministicFallbackDecision({
      session,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      timeSnapshot,
      classification,
    });
    return {
      ...decision,
      policyValidated: true,
      candidateClaims: [],
      topicsMentioned: [],
      observedSignals: [],
    };
  }

  // Ambiguous negative reply ("no") requires clarification, never advance
  if (classification?.requiresClarification && classification?.intent === 'UNCLEAR') {
    const decision = buildDeterministicFallbackDecision({
      session,
      currentStage,
      currentQuestion,
      nextQuestionCandidate,
      nextStageCandidate,
      timeSnapshot,
      classification,
    });
    return {
      ...decision,
      policyValidated: true,
      candidateClaims: [],
      topicsMentioned: [],
      observedSignals: [],
    };
  }

  if (agentResult?.ok && agentResult.decision) {
    // If agent tried to advance on an off-topic or unclarified answer, force clarify
    if (
      classification?.intent === 'OFF_TOPIC' &&
      ['MOVE_NEXT_QUESTION', 'ADVANCE_STAGE'].includes(agentResult.decision.action)
    ) {
      agentResult.decision.action = 'CLARIFY_OR_REPEAT';
      agentResult.decision.spokenResponse = `Could you please clarify how that relates to ${currentQuestion?.prompt || currentQuestion?.questionText || 'the question'}?`;
    }

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
      classification,
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
    classification,
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
