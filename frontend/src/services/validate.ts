// Validation of data that comes from outside (imported backups, lesson editor). Messages are Persian.
import type { Chapter, ContentSource, Course, Lesson, LessonContent, Level } from "../types/course";
import type { ChatMessage, ChatThread } from "../types/chat";

const fail = (m: string): never => { throw new Error(m); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const LEVEL_VALUES: Level[] = ["beginner", "intermediate", "advanced"];

function s(v: unknown, max: number, where: string, opts: { min?: number } = {}): string {
  if (typeof v !== "string") return fail(`${where}: مقدار متنی نیست.`);
  if (v.length > max) return fail(`${where}: طولانی‌تر از حد مجاز است.`);
  if (v.trim().length < (opts.min ?? 0)) return fail(`${where}: نباید خالی باشد.`);
  return v;
}
const n = (v: unknown, where: string): number => (typeof v === "number" && Number.isFinite(v) ? v : fail(`${where}: عدد معتبر نیست.`));
const arr = (v: unknown, max: number, where: string): unknown[] =>
  !Array.isArray(v) ? fail(`${where}: فهرست نیست.`) : v.length > max ? fail(`${where}: تعداد بیش از حد مجاز است.`) : v;

/** Used for the lesson editor AND imported files. */
export function validateContent(v: unknown, where = "محتوای درس"): LessonContent {
  if (!isObj(v)) return fail(`${where}: ساختار نامعتبر است.`);
  const strs = (x: unknown, max: number, len: number, w: string) => arr(x, max, w).map((i, k) => s(i, len, `${w} ${k + 1}`));
  const exercises = arr(v.exercises, 10, "تمرین‌ها").map((e, i) => {
    if (!isObj(e)) return fail(`تمرین ${i + 1}: ساختار نامعتبر است.`);
    return { question: s(e.question, 1000, `تمرین ${i + 1}`, { min: 1 }), hint: s(e.hint ?? "", 600, `راهنمای تمرین ${i + 1}`), sampleAnswer: s(e.sampleAnswer ?? "", 2000, `پاسخ نمونه ${i + 1}`) };
  });
  const quiz = arr(v.quiz, 12, "آزمون").map((q, i) => {
    if (!isObj(q)) return fail(`سؤال ${i + 1}: ساختار نامعتبر است.`);
    const options = strs(q.options, 6, 300, `گزینه‌های سؤال ${i + 1}`);
    const idx = n(q.correctIndex, `پاسخ درست سؤال ${i + 1}`);
    if (options.length < 2 || options.some(o => !o.trim())) return fail(`سؤال ${i + 1}: دست‌کم دو گزینه پرشده لازم است.`);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) return fail(`سؤال ${i + 1}: گزینه درست انتخاب نشده است.`);
    return { question: s(q.question, 600, `سؤال ${i + 1}`, { min: 1 }), options, correctIndex: idx, explanation: s(q.explanation ?? "", 800, `توضیح سؤال ${i + 1}`) };
  });
  return {
    intro: s(v.intro ?? "", 4000, "مقدمه"), objectives: strs(v.objectives, 8, 300, "اهداف"),
    explanation: s(v.explanation, 12000, "آموزش", { min: 1 }), examples: strs(v.examples, 6, 2000, "مثال‌ها"),
    notes: strs(v.notes, 8, 600, "نکته‌ها"), exercises, quiz, summary: s(v.summary ?? "", 2500, "جمع‌بندی")
  };
}

export function validateCourse(v: unknown, index = 0): Course {
  const w = `دوره ${index + 1}`;
  if (!isObj(v)) return fail(`${w}: ساختار نامعتبر است.`);
  const level = v.level as Level;
  if (!LEVEL_VALUES.includes(level)) return fail(`${w}: سطح نامعتبر است.`);
  const chapters: Chapter[] = arr(v.chapters, 50, `${w} (فصل‌ها)`).map((c, ci) => {
    if (!isObj(c)) return fail(`${w}، فصل ${ci + 1}: نامعتبر است.`);
    const lessons: Lesson[] = arr(c.lessons, 100, `${w}، فصل ${ci + 1} (درس‌ها)`).map((l, li) => {
      if (!isObj(l)) return fail(`${w}، درس ${li + 1}: نامعتبر است.`);
      const lesson: Lesson = { id: s(l.id, 100, "شناسه درس", { min: 1 }), title: s(l.title, 150, "عنوان درس", { min: 1 }), completed: l.completed === true };
      if (l.completedAt !== undefined) lesson.completedAt = n(l.completedAt, "زمان تکمیل");
      if (l.content !== undefined) {
        lesson.content = validateContent(l.content, `${w}، محتوای درس ${li + 1}`);
        const src = l.contentSource as ContentSource;
        lesson.contentSource = src === "ai" || src === "edited" || src === "manual" ? src : "manual";
        if (typeof l.contentModel === "string") lesson.contentModel = l.contentModel.slice(0, 100);
        if (l.contentUpdatedAt !== undefined) lesson.contentUpdatedAt = n(l.contentUpdatedAt, "زمان محتوا");
      }
      return lesson;
    });
    return { id: s(c.id, 100, "شناسه فصل", { min: 1 }), title: s(c.title, 150, "عنوان فصل", { min: 1 }), lessons };
  });
  const course: Course = {
    id: s(v.id, 100, `${w} (شناسه)`, { min: 1 }), title: s(v.title, 100, `${w} (عنوان)`, { min: 1 }),
    description: s(v.description ?? "", 1000, `${w} (توضیحات)`), subject: s(v.subject, 100, `${w} (موضوع)`, { min: 1 }),
    level, goal: s(v.goal ?? "", 500, `${w} (هدف)`), chapters, isDemo: v.isDemo === true,
    createdAt: n(v.createdAt, `${w} (زمان ساخت)`), updatedAt: n(v.updatedAt, `${w} (زمان ویرایش)`)
  };
  if (typeof v.lastLessonId === "string") course.lastLessonId = v.lastLessonId.slice(0, 100);
  return course;
}

export function validateThread(v: unknown, index = 0): ChatThread {
  const w = `گفتگو ${index + 1}`;
  if (!isObj(v)) return fail(`${w}: ساختار نامعتبر است.`);
  const messages = arr(v.messages, 200, w).map((m, i): ChatMessage => {
    if (!isObj(m)) return fail(`${w}، پیام ${i + 1}: نامعتبر است.`);
    const role = m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : fail(`${w}، پیام ${i + 1}: نقش نامعتبر است.`);
    return { role, content: s(m.content, 8000, `${w}، پیام ${i + 1}`), at: n(m.at, `${w}، زمان پیام`) };
  });
  return { id: s(v.id, 250, `${w} (شناسه)`, { min: 1 }), messages, updatedAt: n(v.updatedAt, `${w} (زمان)`) };
}
