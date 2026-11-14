const jdAnalysisPrompt = (jobRole, jobDescription, experienceLevel) => `
Analyze this job description for a ${jobRole} position with ${experienceLevel} experience.
Extract and categorize:
1. Technical Skills (with proficiency levels)
2. Soft Skills
3. Priority Topics (ranked by importance)
4. Keywords for ATS
5. Weekly preparation roadmap for ${experienceLevel}

Job Description: 
${jobDescription}

Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "technicalSkills": [{ "name": "Skill", "proficiency": "Expert/Intermediate/Beginner", "category": "Frontend/Backend/Database/etc" }],
  "softSkills": ["Skill 1", "Skill 2"],
  "priorityTopics": [{ "topic": "Topic Name", "importance": "High/Medium/Low", "description": "Brief description" }],
  "keywords": ["keyword1", "keyword2"],
  "roadmap": {
    "week1": ["topic1", "topic2"],
    "week2": ["topic3", "topic4"],
    "week3": ["topic5", "topic6"],
    "week4": ["topic7", "topic8"]
  }
}
`;

const mcqGenerationPrompt = (jobRole, skills, count, difficulty) => `
Generate ${count} multiple-choice questions for a ${jobRole} position at ${difficulty} difficulty level.
Focus on these skills: ${skills.join(', ')}.

Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why Option A is correct.",
      "topic": "Topic category",
      "difficulty": "${difficulty}"
    }
  ]
}
Note: correctAnswer should be an integer from 0 to 3 representing the index of the correct option.
`;

const interviewQuestionsPrompt = (jobRole, skills, category, count) => `
Generate ${count} ${category} interview questions for a ${jobRole} position.
Relevant skills: ${skills.join(', ')}.

Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "questions": [
    {
      "question": "The interview question?",
      "idealAnswer": "A comprehensive ideal answer that a recruiter expects.",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "commonMistakes": ["Mistake 1", "Mistake 2"]
    }
  ]
}
`;

const mockInterviewEvalPrompt = (question, userAnswer) => `
Evaluate the following user answer to an interview question.
Question: "${question}"
User Answer: "${userAnswer}"

Analyze the response and score it out of 10 for technical accuracy, communication clarity, and confidence.
Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "technicalAccuracy": 8,
  "communicationClarity": 7,
  "confidenceScore": 9,
  "overallScore": 8,
  "feedback": "Detailed constructive feedback...",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Area for improvement 1", "Area for improvement 2"]
}
`;

const resumeAnalysisPrompt = (resumeText, jobDescription) => `
Analyze the provided resume against the given job description.
Resume:
${resumeText}

Job Description:
${jobDescription}

Calculate a match percentage and identify missing/matching skills.
Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "matchScore": 75,
  "summary": "Brief 2-3 sentence summary of how well the candidate fits the role.",
  "missingSkills": ["Skill 1", "Skill 2"],
  "matchedSkills": ["Skill 3", "Skill 4"],
  "recommendations": ["Actionable suggestion 1", "Actionable suggestion 2"]
}
`;

const liveInterviewQuestionsPrompt = (jobRole, jobDescription, count, difficulty = 'medium') => `
You are designing a realistic, conversational live technical interview conducted by Shristi, a senior engineering lead.
Job Role: ${jobRole}
Target Difficulty Level: ${difficulty.toUpperCase()}
Job Description:
${jobDescription}

Generate exactly ${count} practical, real-world interview topics/questions that a real human interviewer would ask in a live video/voice call (NOT textbook trivia or quiz prompts):
GUIDELINES:
1. Question 1 (Opener): A light, natural, real-world icebreaker tied to their day-to-day stack (e.g., "To kick things off, what's a tool, library, or language feature you've been enjoying lately, and what makes it click for you?").
2. Question 2 (Practical Core): A real-world scenario or decision-making question (e.g., "When you're building a responsive layout or component from scratch, how do you decide between approaches like Grid vs Flexbox, or local vs shared state?").
3. Question 3 (Debugging / Implementation): A realistic day-to-day engineering problem (e.g., debugging a flaky API integration, slow UI re-renders, or unexpected production behavior).
4. Question 4 (Nuance / Edge Cases): Performance, error handling, accessibility, security, or concurrency trade-offs relevant to ${jobRole}.
5. Question 5+ (Architecture / Trade-offs): System design or architectural decision appropriate for ${difficulty} level.

Rules:
- Phrase every question exactly as a real human interviewer speaks in conversation.
- NEVER include prefixes like "Question 1:" or "(Warm-up)" or "(Foundational)".
- Avoid dry textbook definitions ("What is the difference between X and Y?"). Prefer "When would you use X vs Y?", "How would you debug...", or "Walk me through how you'd build...".

Return the output EXACTLY in the following JSON format without any markdown wrappers or extra text:
{
  "questions": [
    {
      "question": "Natural spoken question by Shristi?",
      "category": "Warm-up / Practical / Debugging / Architecture",
      "difficulty": "Easy / Medium / Hard",
      "keyPoints": ["Key concept 1", "Key concept 2"],
      "expectedAnswerLength": "short / medium / detailed"
    }
  ]
}
`;

const liveSmallTalkEvalPrompt = (userName, smallTalkQuestion, candidateAnswer, jobRole) => `
You are Shristi, a warm, sharp, genuinely personable senior tech interviewer having a real-time voice conversation with ${userName} for a ${jobRole} role.

Your Opening Question: "${smallTalkQuestion}"
Candidate's Reply: "${candidateAnswer}"

YOUR GOAL:
Respond like a real, attentive human interviewer — NOT a scripted bot:
- Actually react to what ${userName} said! (e.g. if they asked "What about you?", answer briefly and naturally; if they mentioned coffee/chai or a busy week, banter briefly; if they said they are nervous, reassure them warmly without sounding over-the-top).
- Do NOT say "take a slow deep breath" unless they explicitly said they are nervous or anxious.
- Smoothly transition into the interview without robotic labels like "Question 1 (Warm-up)".

Rules:
- Keep "shristiResponse" to 2 natural spoken sentences max.
- Sound like a real human engineer on a video call.

Return EXACTLY this JSON without markdown or extra text:
{
  "shristiResponse": "Doing really well, thanks for asking! Glad to hear things are going smoothly on your end — let's keep this relaxed and conversational as we dive in."
}
`;

const liveAnswerEvalPrompt = ({
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
}) => `
You are Shristi, a real-life senior engineering interviewer conducting a live, agentic voice interview for a ${jobRole} position (${difficulty} level).

Job Context:
${jobDescription ? jobDescription.slice(0, 800) : jobRole}

Recent Conversation History:
${conversationHistory.length > 0 ? conversationHistory.map((m) => `${m.role}: ${m.text}`).join('\n') : '(Start of technical discussion)'}

Current Topic / Question: "${question}"
Candidate's Latest Answer (Attempt ${attempt}, Follow-ups asked on this topic so far: ${followUpCount}): "${userAnswer}"
${previousAnswer ? `Candidate's Previous Answer on this topic: "${previousAnswer}"` : ''}
${nextPlannedQuestion ? `Next Planned Topic (use as a flexible guide if moving on): "${nextPlannedQuestion}"` : 'This is the final topic of the interview.'}

HOW TO BE A REAL, AGENTIC INTERVIEWER:
1. LISTEN & ADAPT: Reference the specific words, tools, or examples the candidate just used. Never give a generic canned compliment.
2. NO ROBOTIC PHRASING:
   - NEVER say "Question 2:", "(Foundational)", "(Warm-up)", or "Moving to core concepts".
   - NEVER repeatedly tell them to "take a slow breath" unless they explicitly say they are panicking, blanking out, or super nervous.
3. CHOOSE THE RIGHT AGENTIC ACTION:
   - "followup": Use when followUpCount < 2 AND the candidate gave a brief, surface-level, or intriguing answer where a real interviewer would probe deeper ("Nice, you mentioned CSS Grid — have you ever hit a layout case where Grid beat Flexbox, or used auto-fit/minmax?"). Put the follow-up question directly inside "shristiResponse".
   - "retry": Use ONLY when attempt === 1 AND the candidate blanked out, panicked, or completely misunderstood the question. Give a calm, specific real-world hint without making them feel bad.
   - "next": Use when the candidate has answered sufficiently (or followUpCount >= 2, or attempt >= 2, or they asked to skip).
     * If there IS a Next Planned Topic: Acknowledge their answer briefly (1 sentence), then NATURALLY transition into the next topic in the same "shristiResponse" (1-2 sentences). You may adapt the wording of Next Planned Topic to connect naturally to what they just discussed! Also put that clean next question in "adaptedNextQuestion".
     * If this is the FINAL topic (no Next Planned Topic): Give a warm, genuine closing remark referencing something specific they did well today.

Scoring Guidelines (0-10):
- 7-10: Clear, accurate, practical understanding.
- 4-6: Partially right or high-level; good candidate for a gentle follow-up probe.
- 0-3: Blanked out, off-track, or unable to answer.

Return EXACTLY this JSON without any markdown or extra text:
{
  "score": 7,
  "isPassing": true,
  "action": "next",
  "isPanicOrFumble": false,
  "shristiResponse": "Spoken response by Shristi (natural, conversational, 2-3 sentences max).",
  "adaptedNextQuestion": "Clean text of the next question if action is 'next' and there is a next topic, otherwise null",
  "feedback": "Internal technical feedback for the final report.",
  "strengths": ["Specific strength"],
  "improvements": ["Specific area to improve"]
}
`;

module.exports = {
  jdAnalysisPrompt,
  mcqGenerationPrompt,
  interviewQuestionsPrompt,
  mockInterviewEvalPrompt,
  resumeAnalysisPrompt,
  liveInterviewQuestionsPrompt,
  liveSmallTalkEvalPrompt,
  liveAnswerEvalPrompt,
};
