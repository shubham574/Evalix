const LiveInterview = require('../models/LiveInterview');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateLiveQuestions, evaluateSmallTalk, evaluateLiveAnswer } = require('../services/liveInterview.service');
const { LIVE_INTERVIEW_GEMINI_API_KEY } = require('../config/env');

// Resolve which Gemini key to use:
// 1. User's own key (from UI) — highest priority
// 2. Dedicated Live Interview key (from server env)
const resolveApiKey = (req) =>
  req.headers['x-gemini-api-key'] || LIVE_INTERVIEW_GEMINI_API_KEY || null;

// @desc    Start a new live interview session
// @route   POST /api/live-interview/start
// @access  Private
exports.startInterview = asyncHandler(async (req, res, next) => {
  const { userName, jobRole, jobDescription, totalQuestions = 5, difficulty = 'medium' } = req.body;

  if (!userName || !jobRole || !jobDescription) {
    return next(new ApiError(400, 'Please provide userName, jobRole, and jobDescription'));
  }

  const customApiKey = resolveApiKey(req);

  // Generate questions tailored to the JD with progressive difficulty (starting with a light one-line warm-up)
  const aiResult = await generateLiveQuestions(
    jobRole,
    jobDescription,
    totalQuestions,
    difficulty,
    customApiKey
  );

  const questions = (aiResult.questions || []).map((q) => ({
    question: q.question,
    category: q.category || 'Technical',
    difficulty: q.difficulty || difficulty || 'Medium',
    keyPoints: q.keyPoints || [],
  }));

  // Friendly, comforting non-technical Indian small-talk templates to ease interview anxiety
  const smallTalkTemplates = [
    `Namaste ${userName}! It is so wonderful to meet you today. I'm Shristi! Before we jump into anything technical, please take a slow, comfortable breath and relax. How has your day been going so far? Did you manage to grab a nice cup of chai or coffee before joining?`,
    `Hello ${userName}! A very warm welcome to you today. I'm Shristi, your interviewer. Take a comfortable breath — there is zero stress here today! How has your week been treating you so far? Everything going well on your side?`,
    `Namaste ${userName}! So great to have you here today. Before we talk tech, let's ease in. How are things on your side today? Feeling relaxed and comfortable?`
  ];
  const smallTalkQuestion = smallTalkTemplates[Math.floor(Math.random() * smallTalkTemplates.length)];

  const session = await LiveInterview.create({
    userId: req.auth.userId,
    userName,
    jobRole,
    jobDescription,
    totalQuestions: questions.length,
    difficulty,
    smallTalkQuestion,
    smallTalkCompleted: false,
    questions,
  });

  res.status(201).json({
    success: true,
    data: session,
  });
});

// @desc    Submit answer for current turn; get Shristi's response + action
// @route   POST /api/live-interview/:id/turn
// @access  Private
exports.submitTurn = asyncHandler(async (req, res, next) => {
  const { questionIndex, userAnswer, attempt = 1, previousAnswer = null } = req.body;
  const sessionId = req.params.id;

  if (questionIndex === undefined || !userAnswer) {
    return next(new ApiError(400, 'Please provide questionIndex and userAnswer'));
  }

  const session = await LiveInterview.findById(sessionId);
  if (!session) return next(new ApiError(404, 'Live interview session not found'));
  if (session.userId.toString() !== req.auth.userId) return next(new ApiError(401, 'Not authorized'));
  if (session.status === 'completed') return next(new ApiError(400, 'Interview already completed'));

  const customApiKey = resolveApiKey(req);

  // Handle Small-Talk Icebreaker Turn (questionIndex === -1)
  if (questionIndex === -1) {
    const evaluation = await evaluateSmallTalk(
      session.userName,
      session.smallTalkQuestion || 'How has your day been going so far?',
      userAnswer,
      session.jobRole,
      customApiKey
    );

    const spokenResponse = evaluation.shristiResponse ||
      `That is so great to hear! Take a deep breath — zero stress today, we are just having a friendly conversation. Let's start nice and easy with a quick warm-up question!`;

    session.smallTalkCompleted = true;
    session.turns.push({
      questionIndex: -1,
      attempt: 1,
      userAnswer,
      score: 10,
      isPassing: true,
      action: 'next',
      shristiResponse: spokenResponse,
      feedback: 'Small talk icebreaker completed with positive rapport.',
      strengths: ['Warm and approachable communication'],
      improvements: [],
    });

    await session.save();

    return res.status(200).json({
      success: true,
      data: {
        score: 10,
        isPassing: true,
        action: 'next',
        isSmallTalk: true,
        shristiResponse: spokenResponse,
        feedback: 'Comforted and ready for Question 1',
        strengths: ['Warm and approachable communication'],
        improvements: [],
      },
    });
  }

  const question = session.questions[questionIndex];
  if (!question) return next(new ApiError(400, 'Invalid question index'));

  // Build recent conversation history for true agentic memory
  const conversationHistory = (session.turns || []).slice(-8).flatMap((t) => [
    { role: 'Candidate', text: t.userAnswer },
    { role: 'Shristi', text: t.shristiResponse },
  ]);

  const followUpCount = (session.turns || []).filter(
    (t) => t.questionIndex === questionIndex && t.action === 'followup'
  ).length;

  const nextPlannedObj = session.questions[questionIndex + 1] || null;
  const nextPlannedQuestion = nextPlannedObj ? nextPlannedObj.question : null;

  // Get Shristi's agentic evaluation with full context
  const evaluation = await evaluateLiveAnswer({
    question: question.question,
    userAnswer,
    jobRole: session.jobRole,
    jobDescription: session.jobDescription,
    difficulty: session.difficulty,
    attempt,
    previousAnswer,
    conversationHistory,
    nextPlannedQuestion,
    followUpCount,
    customApiKey,
  });

  // Prevent infinite loops on retry or follow-up
  if ((attempt >= 2 && evaluation.action === 'retry') || (followUpCount >= 2 && evaluation.action === 'followup')) {
    evaluation.action = 'next';
    if (nextPlannedQuestion && !evaluation.adaptedNextQuestion) {
      evaluation.adaptedNextQuestion = nextPlannedQuestion;
      evaluation.shristiResponse =
        `${evaluation.shristiResponse || 'Thanks for sharing that!'} Moving on — ${nextPlannedQuestion}`;
    }
  }

  let nextQuestionText = null;
  if (evaluation.action === 'next' && nextPlannedObj) {
    nextQuestionText = (evaluation.adaptedNextQuestion && evaluation.adaptedNextQuestion.trim()) || nextPlannedQuestion;
    if (nextQuestionText !== nextPlannedObj.question) {
      session.questions[questionIndex + 1].question = nextQuestionText;
    }
  }

  // Record the turn
  session.turns.push({
    questionIndex,
    attempt,
    userAnswer,
    score: evaluation.score || 0,
    isPassing: evaluation.isPassing || false,
    action: evaluation.action || 'next',
    shristiResponse: evaluation.shristiResponse || '',
    feedback: evaluation.feedback || '',
    strengths: evaluation.strengths || [],
    improvements: evaluation.improvements || [],
  });

  await session.save();

  res.status(200).json({
    success: true,
    data: {
      score: evaluation.score,
      isPassing: evaluation.isPassing,
      action: evaluation.action,
      isPanicOrFumble: evaluation.isPanicOrFumble || false,
      shristiResponse: evaluation.shristiResponse,
      nextQuestion: nextQuestionText,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
    },
  });
});

// @desc    Complete the live interview and compute overall score
// @route   POST /api/live-interview/:id/complete
// @access  Private
exports.completeInterview = asyncHandler(async (req, res, next) => {
  const session = await LiveInterview.findById(req.params.id);
  if (!session) return next(new ApiError(404, 'Not found'));
  if (session.userId.toString() !== req.auth.userId) return next(new ApiError(401, 'Not authorized'));

  const { turns } = session;
  if (turns.length === 0) return next(new ApiError(400, 'No answers recorded'));

  // Calculate aggregate stats from all passing turns (best attempt per question), ignoring small talk (-1)
  const questionMap = {};
  turns.forEach((t) => {
    const key = t.questionIndex;
    if (key >= 0) {
      if (!questionMap[key] || t.score > questionMap[key].score) {
        questionMap[key] = t;
      }
    }
  });

  const bestTurns = Object.values(questionMap);
  const totalScore = bestTurns.reduce((sum, t) => sum + (t.score || 0), 0);
  const averageScore = bestTurns.length > 0 ? Math.round((totalScore / bestTurns.length) * 10) : 100; // convert 0-10 → 0-100

  const allStrengths = bestTurns.flatMap((t) => t.strengths || []);
  const allWeaknesses = bestTurns.flatMap((t) => t.improvements || []);

  const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5);
  const uniqueWeaknesses = [...new Set(allWeaknesses)].slice(0, 5);

  session.status = 'completed';
  session.overallFeedback = {
    averageScore,
    totalTurns: turns.length,
    strengths: uniqueStrengths,
    weaknesses: uniqueWeaknesses,
    recommendations:
      uniqueWeaknesses.length > 0
        ? `Focus on improving: ${uniqueWeaknesses.slice(0, 2).join(' and ')}.`
        : 'Excellent performance! Keep practicing to stay sharp.',
  };

  await session.save();

  res.status(200).json({
    success: true,
    data: session,
  });
});

// @desc    Get all live interview sessions for the user
// @route   GET /api/live-interview
// @access  Private
exports.getInterviews = asyncHandler(async (req, res, next) => {
  const sessions = await LiveInterview.find({ userId: req.auth.userId }).sort('-createdAt');
  res.status(200).json({ success: true, count: sessions.length, data: sessions });
});

// @desc    Get a single live interview session
// @route   GET /api/live-interview/:id
// @access  Private
exports.getInterview = asyncHandler(async (req, res, next) => {
  const session = await LiveInterview.findById(req.params.id);
  if (!session) return next(new ApiError(404, 'Not found'));
  if (session.userId.toString() !== req.auth.userId) return next(new ApiError(401, 'Not authorized'));
  res.status(200).json({ success: true, data: session });
});
