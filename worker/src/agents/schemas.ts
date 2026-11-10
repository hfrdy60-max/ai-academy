import { HttpError } from "../security/errors";
import { clean } from "../security/validate";

export interface Exercise { question: string; hint: string; sampleAnswer: string }
export interface QuizItem { question: string; options: string[]; correctIndex: number; explanation: string }
export interface LessonContent {
  intro: string; objectives: string[]; explanation: string; examples: string[]; notes: string[];
  exercises: Exercise[]; quiz: QuizItem[]; summary: string;
}
export interface Outline { chapters: { title: string; lessons: string[] }[] }
export interface CheckResult { verdict: "correct" | "partial" | "incorrect"; feedback: string }

const bad = () => new HttpError(502, "ai_bad_output");

/** AI output is untrusted: pull out one JSON object, then validate every field below. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw bad();
  try { return JSON.parse(t.slice(a, b + 1)); } catch { throw bad(); }
}

const text = (v: unknown, max: number): string => {
  const s = Array.isArray(v) ? v.filter(x => typeof x === "string").join("\n\n") : v;
  return typeof s === "string" ? clean(s).slice(0, max) : "";
};
const list = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.map(x => text(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function validateOutline(raw: unknown): Outline {
  if (!isObj(raw) || !Array.isArray(raw.chapters)) throw bad();
  const chapters = raw.chapters.slice(0, 12).map(c => isObj(c) ? { title: text(c.title, 150), lessons: list(c.lessons, 10, 150) } : null)
    .filter((c): c is { title: string; lessons: string[] } => !!c && !!c.title && c.lessons.length > 0);
  if (chapters.length === 0) throw bad();
  return { chapters };
}

export function validateLesson(raw: unknown): LessonContent {
  if (!isObj(raw)) throw bad();
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : []).slice(0, 6).map(e => isObj(e)
    ? { question: text(e.question, 1000), hint: text(e.hint, 600), sampleAnswer: text(e.sampleAnswer, 2000) } : null)
    .filter((e): e is Exercise => !!e && !!e.question);
  const quiz = (Array.isArray(raw.quiz) ? raw.quiz : []).slice(0, 8).map(q => {
    if (!isObj(q)) return null;
    const options = list(q.options, 6, 300);
    const idx = Number(q.correctIndex);
    if (options.length < 2 || !Number.isInteger(idx) || idx < 0 || idx >= options.length) return null; // drop questions we cannot grade
    return { question: text(q.question, 600), options, correctIndex: idx, explanation: text(q.explanation, 800) };
  }).filter((q): q is QuizItem => !!q && !!q.question);
  const lesson: LessonContent = {
    intro: text(raw.intro, 4000), objectives: list(raw.objectives, 8, 300), explanation: text(raw.explanation, 36000),
    examples: list(raw.examples, 6, 2000), notes: list(raw.notes, 8, 600), exercises, quiz, summary: text(raw.summary, 2500)
  };
  if (!lesson.explanation || lesson.objectives.length === 0) throw bad();
  return lesson;
}

export function validateCheck(raw: unknown): CheckResult {
  if (!isObj(raw)) throw bad();
  const v = raw.verdict;
  if (v !== "correct" && v !== "partial" && v !== "incorrect") throw bad();
  const feedback = text(raw.feedback, 2000);
  if (!feedback) throw bad();
  return { verdict: v, feedback };
}

export const validateChatReply = (t: string): string => {
  const s = clean(t).slice(0, 8000);
  if (!s) throw bad();
  return s;
};
