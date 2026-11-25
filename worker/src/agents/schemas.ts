import { HttpError } from "../security/errors";
import { clean } from "../security/validate";
import type { OutlinePreviousChapter } from "./requests";

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

export function validateOutline(raw: unknown, level: "beginner" | "intermediate" | "advanced" = "beginner", chapterCount?: number, previousChapters: OutlinePreviousChapter[] = []): Outline {
  const expected = {
    beginner: { chapters: 5, lessons: 25 },
    intermediate: { chapters: 10, lessons: 50 },
    advanced: { chapters: 20, lessons: 100 }
  }[level];
  const expectedChapters = chapterCount ?? expected.chapters;
  if (!Number.isInteger(expectedChapters) || expectedChapters < 1 || expectedChapters > expected.chapters || !isObj(raw) || !Array.isArray(raw.chapters) || raw.chapters.length !== expectedChapters) {
    throw new HttpError(502, "ai_outline_incomplete");
  }
  const normalizeTitle = (value: string) => value
    .normalize("NFKC")
    .toLocaleLowerCase("fa")
    .replace(/[\u200c\u200d\s\u0640]/g, "")
    .replace(/[\p{P}\p{S}]/gu, "");
  const chapterTitles = new Set<string>(previousChapters.map(chapter => normalizeTitle(chapter.title)));
  const lessonTitles = new Set<string>(previousChapters.flatMap(chapter => chapter.lessons.map(normalizeTitle)));
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
  if (totalLessons !== expectedChapters * 5) throw new HttpError(502, "ai_outline_incomplete");
  return { chapters };
}

const LESSON_QUALITY = {
  // Keep a meaningful quality floor without rejecting useful lessons because one
  // generated section is slightly shorter than a model-specific target.
  beginner: { explanation: 1800, intro: 50, summary: 70, objectives: 3, examples: 2, notes: 1, exercises: 2, quiz: 3 },
  intermediate: { explanation: 3200, intro: 70, summary: 100, objectives: 3, examples: 2, notes: 2, exercises: 2, quiz: 3 },
  advanced: { explanation: 6000, intro: 100, summary: 150, objectives: 4, examples: 2, notes: 2, exercises: 3, quiz: 4 }
} as const;

function normalizeLesson(raw: Record<string, unknown>): LessonContent {
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

  return {
    intro: text(raw.intro, 5000), objectives: list(raw.objectives, 8, 500), explanation: text(raw.explanation, 50000),
    examples: list(raw.examples, 6, 3500), notes: list(raw.notes, 8, 1200), exercises, quiz, summary: text(raw.summary, 3000)
  };
}

function qualityIssuesForLesson(lesson: LessonContent, level: "beginner" | "intermediate" | "advanced"): string[] {
  const q = LESSON_QUALITY[level];
  const issues: string[] = [];
  if (lesson.explanation.length < q.explanation) issues.push(`توضیح اصلی ${lesson.explanation.length} حرف است و حداقل ${q.explanation} حرف لازم دارد`);
  if (lesson.intro.length < q.intro) issues.push("مقدمه کوتاه یا خالی است");
  if (lesson.summary.length < q.summary) issues.push("جمع‌بندی کوتاه یا خالی است");
  if (lesson.objectives.length < q.objectives) issues.push(`تعداد هدف‌ها ${lesson.objectives.length} است؛ حداقل ${q.objectives} هدف لازم است`);
  if (lesson.examples.length < q.examples) issues.push(`تعداد مثال‌ها ${lesson.examples.length} است؛ حداقل ${q.examples} مثال لازم است`);
  if (lesson.notes.length < q.notes) issues.push(`تعداد نکته‌ها ${lesson.notes.length} است؛ حداقل ${q.notes} نکته لازم است`);
  if (lesson.exercises.length < q.exercises) issues.push(`تعداد تمرین‌ها ${lesson.exercises.length} است؛ حداقل ${q.exercises} تمرین لازم است`);
  if (lesson.quiz.length < q.quiz) issues.push(`تعداد پرسش‌های آزمون ${lesson.quiz.length} است؛ حداقل ${q.quiz} پرسش لازم است`);
  return issues;
}

/** Describes the exact missing quality elements so a repair request can target them. */
export function lessonQualityIssues(raw: unknown, level: "beginner" | "intermediate" | "advanced" = "beginner"): string[] {
  if (!isObj(raw)) return ["خروجی باید یک شیء JSON معتبر باشد"];
  return qualityIssuesForLesson(normalizeLesson(raw), level);
}

export function validateLesson(raw: unknown, level: "beginner" | "intermediate" | "advanced" = "beginner"): LessonContent {
  if (!isObj(raw)) throw bad();
  const lesson = normalizeLesson(raw);
  if (!lesson.explanation || lesson.objectives.length === 0) throw bad();
  // Reject genuinely incomplete lessons, but avoid an overly high threshold
  // that discards a useful response from a smaller or less consistent model.
  if (qualityIssuesForLesson(lesson, level).length > 0) {
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
