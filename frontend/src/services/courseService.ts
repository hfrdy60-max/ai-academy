import { deleteCourse, getCourse, listCourses, saveCourse } from "../database/courses";
import { fa } from "../lib/format";
import { newId } from "../lib/id";
import type { Chapter, ContentSource, Course, LessonContent, Level } from "../types/course";

export const LIMITS = { title: 100, subject: 100, description: 1000, goal: 500 } as const;

export interface NewCourseInput {
  title: string;
  description: string;
  subject: string;
  level: Level;
  goal: string;
  withSampleStructure: boolean;
  outline?: { title: string; lessons: string[] }[]; // e.g. produced by the AI
}

export interface CourseProgress { done: number; total: number; percent: number }
export interface LessonRef { chapter: Chapter; lessonId: string; title: string }

interface Plan { title: string; lessons: string[] }

function buildChapters(plan: Plan[]): Chapter[] {
  return plan.map(c => ({
    id: newId(),
    title: c.title,
    lessons: c.lessons.map(t => ({ id: newId(), title: t, completed: false }))
  }));
}

// Deliberately small demo-only structure; real curricula must come from a validated AI outline.
const genericPlan = (): Plan[] =>
  [1, 2, 3].map(c => ({
    title: `فصل آزمایشی ${fa(c)}`,
    lessons: [1, 2].map(l => `درس آزمایشی ${fa(l)} از فصل ${fa(c)}`)
  }));

function validateGeneratedOutline(outline: Plan[], level: Level): Plan[] {
  const expected = { beginner: 5, intermediate: 10, advanced: 20 }[level];
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("fa")
    .replace(/[\u200c\u200d\s\u0640]/g, "").replace(/[\\p{P}\\p{S}]/gu, "");
  if (!Array.isArray(outline) || outline.length !== expected) {
    throw new Error(`ساختار دوره ناقص است؛ سطح انتخابی به ${fa(expected)} فصل و هر فصل به ۵ درس نیاز دارد. دوباره طراحی کنید.`);
  }
  const chapterTitles = new Set<string>();
  const lessonTitles = new Set<string>();
  for (const chapter of outline) {
    if (!chapter || typeof chapter.title !== "string" || !chapter.title.trim() ||
        !Array.isArray(chapter.lessons) || chapter.lessons.length !== 5) {
      throw new Error("ساختار دوره ناقص است؛ هر فصل باید عنوان و دقیقاً ۵ درس داشته باشد.");
    }
    const chapterKey = normalize(chapter.title);
    if (!chapterKey || chapterTitles.has(chapterKey)) {
      throw new Error("عنوان فصل‌های دوره تکراری است؛ ساختار را دوباره طراحی کنید.");
    }
    chapterTitles.add(chapterKey);
    for (const lesson of chapter.lessons) {
      if (typeof lesson !== "string" || !lesson.trim()) {
        throw new Error("یکی از درس‌های دوره عنوان معتبر ندارد.");
      }
      const key = normalize(lesson);
      if (!key || lessonTitles.has(key)) {
        throw new Error("عنوان درس‌های دوره تکراری است؛ ساختار را دوباره طراحی کنید.");
      }
      lessonTitles.add(key);
    }
  }
  return outline.map(ch => ({ title: ch.title.trim(), lessons: ch.lessons.map(x => x.trim()) }));
}

export function courseProgress(c: Course): CourseProgress {
  const lessons = c.chapters.flatMap(ch => ch.lessons);
  const done = lessons.filter(l => l.completed).length;
  return { done, total: lessons.length, percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}

/** Where "continue learning" should go: the lesson the learner stopped at, else the first unfinished one. */
export function nextLesson(c: Course): LessonRef | null {
  const flat: LessonRef[] = c.chapters.flatMap(ch => ch.lessons.filter(l => !l.completed).map(l => ({ chapter: ch, lessonId: l.id, title: l.title })));
  if (flat.length === 0) return null;
  return flat.find(x => x.lessonId === c.lastLessonId) ?? flat[0];
}

export function findLesson(c: Course, lessonId: string) {
  for (const chapter of c.chapters) {
    const lesson = chapter.lessons.find(l => l.id === lessonId);
    if (lesson) return { chapter, lesson };
  }
  return null;
}

interface Info { title: string; subject: string; description: string; goal: string }

/** Trim + validate the descriptive fields (used when creating and when editing). */
function checkInfo(i: Info): Info {
  const r = { title: i.title.trim(), subject: i.subject.trim(), description: i.description.trim(), goal: i.goal.trim() };
  if (!r.title) throw new Error("عنوان دوره را وارد کنید.");
  if (!r.subject) throw new Error("موضوع دوره را وارد کنید.");
  if (r.title.length > LIMITS.title) throw new Error(`عنوان نباید بیشتر از ${fa(LIMITS.title)} حرف باشد.`);
  if (r.subject.length > LIMITS.subject) throw new Error(`موضوع نباید بیشتر از ${fa(LIMITS.subject)} حرف باشد.`);
  if (r.description.length > LIMITS.description) throw new Error(`توضیحات نباید بیشتر از ${fa(LIMITS.description)} حرف باشد.`);
  if (r.goal.length > LIMITS.goal) throw new Error(`هدف یادگیری نباید بیشتر از ${fa(LIMITS.goal)} حرف باشد.`);
  return r;
}

export async function createCourse(input: NewCourseInput): Promise<Course> {
  const info = checkInfo(input);
  const now = Date.now();
  const chapters = input.outline
    ? buildChapters(validateGeneratedOutline(input.outline, input.level))
    : input.withSampleStructure ? buildChapters(genericPlan()) : [];
  const course: Course = { id: newId(), ...info, level: input.level, chapters, isDemo: false, createdAt: now, updatedAt: now };
  await saveCourse(course);
  return course;
}

/** Save an edited course (info + chapters + lessons) after validating it. Progress and content of kept lessons are preserved by the editor. */
export async function saveCourseEdits(draft: Course): Promise<Course> {
  const info = checkInfo(draft);
  if (draft.chapters.length > 50) throw new Error("تعداد فصل‌ها نباید بیشتر از ۵۰ باشد.");
  const lessonIds = new Set<string>();
  for (const ch of draft.chapters) {
    if (!ch.title.trim()) throw new Error("عنوان همه فصل‌ها باید پر باشد.");
    if (ch.title.length > 150) throw new Error("عنوان فصل نباید بیشتر از ۱۵۰ حرف باشد.");
    if (ch.lessons.length > 100) throw new Error("تعداد درس‌های هر فصل نباید بیشتر از ۱۰۰ باشد.");
    for (const l of ch.lessons) {
      if (!l.title.trim()) throw new Error("عنوان همه درس‌ها باید پر باشد.");
      if (l.title.length > 150) throw new Error("عنوان درس نباید بیشتر از ۱۵۰ حرف باشد.");
      lessonIds.add(l.id);
    }
  }
  const saved: Course = {
    ...draft, ...info,
    chapters: draft.chapters.map(ch => ({ ...ch, title: ch.title.trim(), lessons: ch.lessons.map(l => ({ ...l, title: l.title.trim() })) })),
    lastLessonId: draft.lastLessonId && lessonIds.has(draft.lastLessonId) ? draft.lastLessonId : undefined,
    updatedAt: Date.now()
  };
  await saveCourse(saved);
  return saved;
}

/** Store (or replace) the teaching content of one lesson. */
export async function setLessonContent(courseId: string, lessonId: string, content: LessonContent, source: ContentSource, model?: string): Promise<Course> {
  const c = await mustGet(courseId);
  const found = findLesson(c, lessonId);
  if (!found) throw new Error("این درس پیدا نشد.");
  found.lesson.content = content;
  found.lesson.contentSource = source;
  found.lesson.contentModel = model || undefined;
  found.lesson.contentUpdatedAt = Date.now();
  c.updatedAt = Date.now();
  await saveCourse(c);
  return c;
}

const DEMOS: { title: string; subject: string; level: Level; goal: string; description: string; plan: Plan[] }[] = [
  {
    title: "مبانی برنامه‌نویسی (نمونه آزمایشی)", subject: "برنامه‌نویسی", level: "beginner",
    goal: "آشنایی با مفاهیم پایه مثل متغیر، شرط و حلقه",
    description: "دوره نمونه برای آزمایش مدیریت دوره و ثبت پیشرفت. محتوای درس‌ها هنوز تولید نشده است.",
    plan: [
      { title: "فصل ۱: مفاهیم پایه", lessons: ["متغیر و نوع داده", "شرط‌ها", "حلقه‌ها"] },
      { title: "فصل ۲: تابع‌ها", lessons: ["تعریف تابع", "پارامتر و خروجی"] }
    ]
  },
  {
    title: "انگلیسی فنی مقدماتی (نمونه آزمایشی)", subject: "زبان انگلیسی", level: "beginner",
    goal: "خواندن دستورالعمل‌ها و برچسب‌های فنی ساده",
    description: "دوره نمونه برای آزمایش مدیریت دوره و ثبت پیشرفت. محتوای درس‌ها هنوز تولید نشده است.",
    plan: [
      { title: "فصل ۱: واژگان پایه", lessons: ["Tools and Parts", "Units and Measurements"] },
      { title: "فصل ۲: خواندن دستورالعمل", lessons: ["Safety Signs", "Following Instructions"] }
    ]
  }
];

/** Adds the sample courses that are not already stored. Returns how many were added. */
export async function seedDemoCourses(): Promise<number> {
  const existing = new Set((await listCourses()).filter(c => c.isDemo).map(c => c.title));
  let added = 0;
  for (const d of DEMOS) {
    if (existing.has(d.title)) continue;
    const now = Date.now() + added; // keep a stable order
    await saveCourse({
      id: newId(), title: d.title, subject: d.subject, level: d.level, goal: d.goal, description: d.description,
      chapters: buildChapters(d.plan), isDemo: true, createdAt: now, updatedAt: now
    });
    added++;
  }
  return added;
}

async function mustGet(id: string): Promise<Course> {
  const c = await getCourse(id);
  if (!c) throw new Error("این دوره پیدا نشد. ممکن است حذف شده باشد.");
  return c;
}

/** Remember where the learner is, so "continue learning" resumes here. */
export async function touchLesson(courseId: string, lessonId: string): Promise<Course> {
  const c = await mustGet(courseId);
  if (c.lastLessonId !== lessonId && findLesson(c, lessonId)) {
    c.lastLessonId = lessonId;
    c.updatedAt = Date.now();
    await saveCourse(c);
  }
  return c;
}

export async function completeLesson(courseId: string, lessonId: string): Promise<Course> {
  const c = await mustGet(courseId);
  const found = findLesson(c, lessonId);
  if (!found) throw new Error("این درس پیدا نشد.");
  if (!found.lesson.completed) { found.lesson.completed = true; found.lesson.completedAt = Date.now(); }
  c.lastLessonId = lessonId;
  c.updatedAt = Date.now();
  await saveCourse(c);
  return c;
}

export const removeCourse = (id: string): Promise<void> => deleteCourse(id);
export { listCourses, getCourse };
