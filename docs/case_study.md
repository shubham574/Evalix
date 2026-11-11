# Case Study: Evalix

## The Problem
Technical interviews are a massive bottleneck for software engineers. While platforms like LeetCode exist for algorithms, behavioral and architectural interviews are difficult to practice without a human partner. Candidates often struggle with structuring their answers or fail to realize when their explanations lack depth. Existing solutions are either too expensive (hiring a real coach) or too rigid (pre-recorded video questions).

## The Solution
**Evalix** is an AI-powered technical interview companion. By leveraging Large Language Models (LLMs), the platform provides a dynamic, conversational interview experience. It doesn't just ask generic questions; it parses a candidate's uploaded resume to ask highly specific questions about their past projects, tech stack, and experiences, mimicking a real-world engineering manager.

## Key Technical Decisions

### 1. Decoupled Architecture
I chose a strict separation between the React client and the Express backend. This allows the API to serve other potential clients (like a mobile app) in the future, and ensures the heavy lifting of PDF parsing and AI communication happens securely on the server, not in the user's browser.

### 2. Google Gemini over OpenAI
I opted for Google's Gemini API (`@google/genai`) for the AI engine. Gemini's massive context window is uniquely suited for processing dense, multi-page resumes and maintaining the context of a long, multi-turn interview conversation without hallucinating or losing thread of the user's background.

### 3. Offloading Authentication to Clerk
Building secure, compliant authentication from scratch is time-consuming and error-prone. By integrating Clerk, I secured the application against common vulnerabilities, implemented seamless social logins, and saved days of development time that was redirected toward the core AI features.

## Challenges & Learnings

### Handling Unstructured LLM Output
One major challenge was ensuring the AI returned data in a format the frontend could predictably render (e.g., separating the 'question text' from 'hints' or 'evaluation criteria'). 
*Solution:* I heavily engineered the system prompts on the backend to enforce strict JSON schemas in the AI's output, and added server-side validation to gracefully handle cases where the AI deviated from the expected format.

### Managing Asynchronous State
With complex flows involving file uploads, AI generation (which can take 5-10 seconds), and database writes, the frontend state could easily become out of sync.
*Solution:* I integrated **React Query**. Its built-in caching, loading states, and automatic retries dramatically simplified the frontend codebase and provided a much smoother user experience during long-polling operations.

## Future Roadmap
- **Audio Integration:** Use the Web Speech API to allow candidates to answer verbally, and use Text-to-Speech for the interviewer's voice.
- **Coding Sandboxes:** Integrate a live code editor (like Monaco) to support live coding rounds, alongside the conversational rounds.
- **Peer Review:** Allow users to share their recorded interview sessions with human mentors for secondary feedback.
