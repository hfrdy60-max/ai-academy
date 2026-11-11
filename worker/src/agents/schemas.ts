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

export function validateOutline(raw: unknown, level: "beginner" | "intermediate" | "advanced" = "beginner"): Outline {
  const expected = {
    beginner: { chapters: 5, lessons: 25 },
    intermediate: { chapters: 10, lessons: 50 },
    advanced: { chapters: 20, lessons: 100 }
  }[level];
  if (!isObj(raw) || !Array.isArray(raw.chapters) || raw.chapters.length !== expected.chapters) {
    throw new HttpError(502, "ai_outline_incomplete");
  }
  const normalizeTitle = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase("fa")
    .replace(/[\u200c\u200d\s\u0640]/g, "")
    .replace(/[\p{P}\p{S}]/gu, "");
  const chapterTitles = new Set<string>();
  const lessonTitles = new Set<string>();
  const chapters = raw.chapters.map(c => {
    if (!isObj(c)) throw new HttpError(502, "ai_outline_incomplete");
    const title = text(c.title, 150);
    const lessons = list(c.lessons, 5, 150);
    if (!title || !Array.isArray(c.lessons) || c.lessons.length !== 5 || lessons.length !== 5) {
      throw new HttpError(502, "ai_outline_incomplete");
    }
    const chapterKey = normalizeTitle(title);
    if (!chapterKey || chapterTitles.has(chapterKey)) throw new HttpError(502, "ai_outline_incomplete");
    chapterTitles.add(chapterKey);
    for (const lessonTitle of lessons) {
      const lessonKey = normalizeTitle(lessonTitle);
      if (!lessonKey || lessonTitles.has(lessonKey)) throw new HttpError(502, "ai_outline_incomplete");
      lessonTitles.add(lessonKey);
    }
    return { title, lessons };
  });
  const totalLessons = chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  if (totalLessons !== expected.lessons) throw new HttpError(502, "ai_outline_incomplete");
  return { chapters };
}

export function validateLesson(raw: unknown, level: "beginner" | "intermediate" | "advanced" = "beginner"): LessonContent {
  if (!isObj(raw)) throw bad();
  const exercises = (Array.isArray(raw.exercises) ? raw.exercises : []).slice(0, 6).map(e => isObj(e)
    ? { question: text(e.question, 1600), hint: text(e.hint, 1000), sampleAnswer: text(e.sampleAnswer, 5000) } : null)
    .filter((e): e is Exercise => !!e && !!e.question && !!e.sampleAnswer);
  const quiz = (Array.isArray(raw.quiz) ? raw.quiz : []).slice(0, 8).map(q => {
    if (!isObj(q)) return null;
    const options = list(q.options, 4, 500);
    const idx = Number(q.correctIndex);
    if (!Array.isArray(q.options) || q.options.length !== 4 || options.length !== 4 || !Number.isInteger(idx) || idx < 0 || idx >= options.length) return null;
    return { question: text(q.question, 900), options, correctIndex: idx, explanation: text(q.explanation, 1400) };
  }).filter((q): q is QuizItem => !!q && !!q.question && !!q.explanation);
  const lesson: LessonContent = {
    intro: text(raw.intro, 5000), objectives: list(raw.objectives, 8, 500), explanation: text(raw.explanation, 50000),
    examples: list(raw.examples, 6, 3500), notes: list(raw.notes, 8, 1200), exercises, quiz, summary: text(raw.summary, 3000)
  };
  if (!lesson.explanation || lesson.objectives.length === 0) throw bad();
  const quality = {
    beginner: { explanation: 2500, intro: 70, summary: 100, objectives: 3, examples: 2, notes: 2, exercises: 2, quiz: 3 },
    intermediate: { explanation: 4500, intro: 90, summary: 150, objectives: 3, examples: 2, notes: 2, exercises: 3, quiz: 4 },
    advanced: { explanation: 8000, intro: 120, summary: 200, objectives: 4, examples: 2, notes: 3, exercises: 3, quiz: 5 }
  }[level];
  // Do not silently present a thin, abbreviated or poorly structured answer as a complete lesson.
  if (
    lesson.explanation.length < quality.explanation ||
    lesson.intro.length < quality.intro ||
    lesson.summary.length < quality.summary ||
    lesson.objectives.length < quality.objectives ||
    lesson.examples.length < quality.examples ||
    lesson.notes.length < quality.notes ||
    lesson.exercises.length < quality.exercises ||
    lesson.quiz.length < quality.quiz
  ) {
    throw new HttpError(502, "ai_content_too_short");
  }
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
