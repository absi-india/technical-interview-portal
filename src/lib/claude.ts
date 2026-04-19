import { GoogleGenerativeAI } from "@google/generative-ai";
import pRetry from "p-retry";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

async function callGemini(system: string, user: string): Promise<string> {
  return pRetry(
    async () => {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: system,
      });
      const result = await model.generateContent(user);
      return result.response.text();
    },
    { retries: 3, minTimeout: 1000, factor: 2 }
  );
}

export interface GeneratedQuestion {
  id: number;
  questionText: string;
  category: string;
  expectedAnswerSummary: string;
  maxScore: number;
  codeLanguageHint: string | null;
}

export async function generateQuestions(
  level: string,
  jobTitle: string,
  jobDescription: string
): Promise<GeneratedQuestion[]> {
  const system = `You are a senior technical interviewer. Generate exactly 10 interview questions
based on the job description and interview level below.

Interview Levels:
- BASIC: Definitions, fundamentals, conceptual understanding
- INTERMEDIATE: Applied knowledge, scenario-based, trade-offs
- ADVANCED: Architecture, system design, optimization, edge cases
- PRACTICAL: Hands-on tasks the candidate implements live (code or structured written response)

Rules:
- Return ONLY a valid JSON array. No markdown, no preamble, no explanation.
- Each object must have:
    id (1–10), questionText, category, expectedAnswerSummary,
    maxScore (always 10),
    codeLanguageHint (null unless PRACTICAL — infer from JD technologies)
- Vary categories: fundamentals, problem-solving, system design, best practices, past experience
- Questions must be directly relevant to the JD's technologies and responsibilities`;

  const user = `Interview Level: ${level}
Job Title: ${jobTitle}
Job Description: ${jobDescription}`;

  const raw = await callGemini(system, user);
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as GeneratedQuestion[];
}

export interface RatingResult {
  score: number;
  rationale: string;
}

export async function rateAnswer(
  questionText: string,
  category: string,
  expectedAnswerSummary: string,
  transcript: string | null,
  codeResponse: string | null,
  level: string
): Promise<RatingResult> {
  const system = `You are a strict but fair technical interviewer evaluating a candidate's response.
Score the response from 0 to 10 based on accuracy, depth, clarity, and relevance.
Return ONLY valid JSON. No markdown, no preamble.
Format: { "score": number, "rationale": "2–3 sentence evaluation" }`;

  const user = `Question: ${questionText}
Category: ${category}
Expected Answer Summary: ${expectedAnswerSummary}
Candidate's Spoken Transcript: ${transcript ?? "No transcript provided"}
Candidate's Code/Written Response: ${codeResponse ?? "N/A"}
Interview Level: ${level}`;

  const raw = await callGemini(system, user);
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as RatingResult;
}
