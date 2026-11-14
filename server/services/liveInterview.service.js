const { generateContent } = require('./gemini.service');
const {
  liveInterviewQuestionsPrompt,
  liveAnswerEvalPrompt,
  liveSmallTalkEvalPrompt,
} = require('../utils/prompts');

/**
 * Generate JD-tailored interview questions for a live session
 */
const generateLiveQuestions = async (jobRole, jobDescription, count, difficulty = 'medium', customApiKey = null) => {
  const prompt = liveInterviewQuestionsPrompt(jobRole, jobDescription, count, difficulty);
  const result = await generateContent(prompt, customApiKey);
  return result;
};

/**
 * Evaluate small talk response and comfort the candidate
 */
const evaluateSmallTalk = async (
  userName,
  smallTalkQuestion,
  userAnswer,
  jobRole,
  customApiKey = null
) => {
  const prompt = liveSmallTalkEvalPrompt(userName, smallTalkQuestion, userAnswer, jobRole);
  const result = await generateContent(prompt, customApiKey);
  return result;
};

/**
 * Evaluate a live answer and get Shristi's adaptive, agentic response
 */
const evaluateLiveAnswer = async ({
  question,
  userAnswer,
  jobRole,
  jobDescription = '',
  difficulty = 'medium',
  attempt = 1,
  previousAnswer = null,
  conversationHistory = [],
  nextPlannedQuestion = null,
  followUpCount = 0,
  customApiKey = null,
}) => {
  const prompt = liveAnswerEvalPrompt({
    question,
    userAnswer,
    jobRole,
    jobDescription,
    difficulty,
    attempt,
    previousAnswer,
    conversationHistory,
    nextPlannedQuestion,
    followUpCount,
  });
  const result = await generateContent(prompt, customApiKey);
  return result;
};

module.exports = {
  generateLiveQuestions,
  evaluateSmallTalk,
  evaluateLiveAnswer,
};
