import type { Level } from "../types";
import { HttpError } from "../security/errors";
import { level, obj, str } from "../security/validate";

export interface CourseCtx { title: string; subject: string; level: Level; goal: string; description: string }
export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface LessonProgression {
  position: number;
  total: number;
  previousLessons: { title: string; summary: string }[];
  nextLessons: string[];
}

function course(v: unknown): CourseCtx {
  const o = obj(v, "course");
  return {
    title: str(o.title, "title", 120), subject: str(o.subject, "subject", 120), level: level(o.level),
    goal: str(o.goal, "goal", 500, { optional: true }), description: str(o.description, "description", 1000, { optional: true })
  };
}

export const parseOutline = (b: unknown) => ({ course: course(obj(b, "body").course) });

export function parseLesson(b: unknown) {
  const o = obj(b, "body");
  let progression: LessonProgression | undefined;
  if (o.progression !== undefined) {
    const p = obj(o.progression, "progression");
    const position = Number(p.position), total = Number(p.total);
    if (!Number.isInteger(position) || !Number.isInteger(total) || position < 1 || total < position || total > 5000) {
      throw new HttpError(400, "invalid_progression");
    }
    const previousLessons = (Array.isArray(p.previousLessons) ? p.previousLessons : []).slice(-3).map(item => {
      const x = obj(item, "previous_lesson");
      return { title: str(x.title, "previous_title", 150), summary: str(x.summary, "previous_summary", 700, { optional: true }) };
    });
    const nextLessons = (Array.isArray(p.nextLessons) ? p.nextLessons : []).slice(0, 2)
      .map(item => str(item, "next_lesson", 150));
    progression = { position, total, previousLessons, nextLessons };
  }
  return {
    course: course(o.course),
    chapterTitle: str(o.chapterTitle, "chapterTitle", 150),
    lessonTitle: str(o.lessonTitle, "lessonTitle", 150),
    instruction: str(o.instruction, "instruction", 500, { optional: true }),
    progression
  };
}

export function parseCheck(b: unknown) {
  const o = obj(b, "body");
  return {
    lessonTitle: str(o.lessonTitle, "lessonTitle", 150), level: level(o.level),
    question: str(o.question, "question", 1000), learnerAnswer: str(o.learnerAnswer, "learnerAnswer", 3000),
    sampleAnswer: str(o.sampleAnswer, "sampleAnswer", 2000, { optional: true })
  };
}

export function parseChat(b: unknown) {
  const o = obj(b, "body");
  const ctxRaw = o.context === undefined ? {} : obj(o.context, "context");
  const context = {
    courseTitle: str(ctxRaw.courseTitle, "courseTitle", 120, { optional: true }),
    subject: str(ctxRaw.subject, "subject", 120, { optional: true }),
    goal: str(ctxRaw.goal, "goal", 500, { optional: true }),
    lessonTitle: str(ctxRaw.lessonTitle, "lessonTitle", 150, { optional: true }),
    lessonText: str(ctxRaw.lessonText, "lessonText", 6000, { optional: true })
  };
  if (!Array.isArray(o.messages) || o.messages.length < 1 || o.messages.length > 20) throw new HttpError(400, "invalid_messages");
  const messages: ChatTurn[] = o.messages.map(m => {
    const mo = obj(m, "message");
    if (mo.role !== "user" && mo.role !== "assistant") throw new HttpError(400, "invalid_messages");
    return { role: mo.role, content: str(mo.content, "message", 4000) };
  });
  if (messages[messages.length - 1].role !== "user") throw new HttpError(400, "invalid_messages");
  return { level: level(o.level), context, messages };
}
