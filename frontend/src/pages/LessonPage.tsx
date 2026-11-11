import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import LessonContentView from "../components/LessonContentView";
import LessonEditor from "../components/LessonEditor";
import TeacherChat from "../components/TeacherChat";
import { useCourse } from "../hooks/useCourses";
import { errMsg } from "../lib/errors";
import { contentToText } from "../lib/lessonText";
import { AiError, generateLesson } from "../services/aiClient";
import { threadId } from "../services/chatService";
import { completeLesson, findLesson, nextLesson, setLessonContent, touchLesson } from "../services/courseService";
import type { LessonContent } from "../types/course";

const SOURCE_LABEL = { ai: "تولیدشده با هوش مصنوعی", edited: "تولیدشده با هوش مصنوعی و ویرایش‌شده", manual: "نوشته‌شده به‌صورت دستی" } as const;
const aiMsg = (e: unknown) => (e instanceof AiError ? e.message : errMsg(e));

export default function LessonPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { course, loading, error, setCourse } = useCourse(courseId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Remember where the learner is so "continue learning" resumes here.
  useEffect(() => {
    if (!courseId || !lessonId) return;
    touchLesson(courseId, lessonId).catch(() => { /* non-critical */ });
  }, [courseId, lessonId]);
  useEffect(() => { setEditing(false); setGenError(null); setSaveError(null); setChatOpen(false); }, [lessonId]);

  if (loading) return <p className="muted" role="status">در حال بارگذاری…</p>;
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>;
  const found = course && lessonId ? findLesson(course, lessonId) : null;
  if (!course || !found) {
    return (
      <div className="card text-center">
        <h1 className="font-bold">درس پیدا نشد</h1>
        <Link to="/courses" className="btn btn-primary mt-4">بازگشت به دوره‌های من</Link>
      </div>
    );
  }
  const { chapter, lesson } = found;
  const content = lesson.content;
  const orderedLessons = course.chapters.flatMap(ch => ch.lessons.map(item => ({ chapterTitle: ch.title, lesson: item })));
  const lessonPosition = orderedLessons.findIndex(item => item.lesson.id === lesson.id);
  const progression = lessonPosition >= 0 ? {
    position: lessonPosition + 1,
    total: orderedLessons.length,
    previousLessons: orderedLessons.slice(Math.max(0, lessonPosition - 3), lessonPosition).map(item => ({
      title: item.lesson.title,
      summary: item.lesson.content?.summary || item.lesson.content?.intro || ""
    })),
    nextLessons: orderedLessons.slice(lessonPosition + 1, lessonPosition + 3).map(item => item.lesson.title)
  } : undefined;

  async function generate(extra: string) {
    if (!course) return;
    setGenerating(true); setGenError(null);
    try {
      const r = await generateLesson(
        { title: course.title, subject: course.subject, level: course.level, goal: course.goal, description: course.description },
        chapter.title, lesson.title, extra.trim(), progression);
      setCourse(await setLessonContent(course.id, lesson.id, r.data, "ai", r.model));
      setInstruction("");
    } catch (e) { setGenError(aiMsg(e)); }
    finally { setGenerating(false); }
  }

  async function saveEdit(c: LessonContent) {
    if (!course) return;
    setSaving(true); setSaveError(null);
    try {
      const source = lesson.contentSource === "ai" || lesson.contentSource === "edited" ? "edited" : "manual";
      setCourse(await setLessonContent(course.id, lesson.id, c, source, lesson.contentModel));
      setEditing(false);
    } catch (e) { setSaveError(errMsg(e)); }
    finally { setSaving(false); }
  }

  async function finish() {
    if (!course || !lessonId) return;
    setSaving(true); setSaveError(null);
    try {
      const updated = await completeLesson(course.id, lessonId);
      setCourse(updated);
      const next = nextLesson(updated);
      navigate(next ? `/courses/${course.id}/lessons/${next.lessonId}` : `/courses/${course.id}`);
    } catch (e) { setSaveError(errMsg(e)); }
    finally { setSaving(false); } // the page stays mounted when moving to the next lesson
  }

  const completeBlock = lesson.completed ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="btn btn-ghost" role="status"><Icon name="check" className="h-4 w-4" />این درس تکمیل شده است</span>
      <Link to={`/courses/${course.id}`} className="btn btn-primary">بازگشت به دوره</Link>
    </div>
  ) : (
    <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={saving} onClick={() => void finish()}>
      <Icon name="check" className="h-4 w-4" />{saving ? "در حال ذخیره…" : "تکمیل درس و ادامه"}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/courses/${course.id}`} className="muted inline-flex min-h-11 items-center gap-1 text-sm hover:underline">
        <Icon name="back" className="h-4 w-4" />{course.title}
      </Link>

      <header className="card space-y-1">
        <p className="muted text-sm">{chapter.title}</p>
        <h1 className="text-xl font-extrabold md:text-2xl">{lesson.title}</h1>
        {course.goal && <p className="muted text-sm">هدف دوره: {course.goal}</p>}
      </header>

      {editing ? (
        <section className="card" aria-label="ویرایش محتوای درس">
          <LessonEditor initial={content ?? null} saving={saving} error={saveError} onSave={c => void saveEdit(c)} onCancel={() => { setEditing(false); setSaveError(null); }} />
        </section>
      ) : content ? (
        <>
          <section className="card space-y-4" aria-label="محتوای درس">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="badge">{lesson.contentSource ? SOURCE_LABEL[lesson.contentSource] : SOURCE_LABEL.manual}{lesson.contentModel ? ` · ${lesson.contentModel}` : ""}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" className="h-4 w-4" />ویرایش</button>
              </div>
            </div>
            {lesson.contentSource !== "manual" && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                این متن را هوش مصنوعی بدون جست‌وجوی زنده در اینترنت نوشته است و ممکن است اشتباه یا ناقص باشد. موارد مهم را با منبع معتبر بررسی کنید.
              </p>
            )}
            <LessonContentView key={lesson.contentUpdatedAt} content={content} lessonTitle={lesson.title} level={course.level} />
          </section>

          <details className="card">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold">تولید مجدد محتوای درس</summary>
            <div className="mt-3 space-y-3">
              <label htmlFor="regen-note" className="block text-sm">توضیح اختیاری برای هوش مصنوعی (مثلاً «ساده‌تر توضیح بده» یا «مثال‌های بیشتری بیاور»)</label>
              <input id="regen-note" className="input" maxLength={500} value={instruction} onChange={e => setInstruction(e.target.value)} />
              <button type="button" className="btn btn-ghost" disabled={generating} onClick={() => setConfirmRegen(true)}><Icon name="refresh" className="h-4 w-4" />تولید مجدد</button>
            </div>
          </details>
        </>
      ) : (
        <section className="card space-y-3" aria-label="محتوای درس">
          <h2 className="font-bold">این درس هنوز محتوا ندارد</h2>
          <p className="muted text-sm leading-7">می‌توانید محتوای درس را با هوش مصنوعی بسازید یا خودتان بنویسید. ساخت محتوا به اینترنت و اتصال هوش مصنوعی در «تنظیمات» نیاز دارد.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={generating} onClick={() => void generate("")}><Icon name="sparkles" className="h-4 w-4" />{generating ? "در حال تولید…" : "تولید محتوا با هوش مصنوعی"}</button>
            <button type="button" className="btn btn-ghost" disabled={generating} onClick={() => setEditing(true)}><Icon name="edit" className="h-4 w-4" />نوشتن دستی</button>
          </div>
        </section>
      )}

      {generating && <p role="status" className="card text-sm">در حال تولید محتوای درس… با توجه به سطح و عمق درس ممکن است چند دقیقه طول بکشد.</p>}
      {genError && (
        <div role="alert" className="card border-red-300 text-sm text-red-800 dark:text-red-200">
          <p>{genError}</p>
          <Link to="/settings" className="mt-2 inline-block underline">رفتن به تنظیمات</Link>
        </div>
      )}
      {!editing && saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{saveError}</p>}

      {!editing && (
        <section aria-label="گفتگو با معلم" className="space-y-3">
          <button type="button" className="btn btn-ghost w-full sm:w-auto" aria-expanded={chatOpen} onClick={() => setChatOpen(o => !o)}>
            <Icon name="chat" className="h-4 w-4" />{chatOpen ? "بستن گفتگو با معلم" : "گفتگو با معلم درباره این درس"}
          </button>
          {chatOpen && (
            <TeacherChat threadKey={threadId.lesson(course.id, lesson.id)} level={course.level}
              context={{ courseTitle: course.title, subject: course.subject, goal: course.goal, lessonTitle: lesson.title, lessonText: content ? contentToText(content) : "" }}
              suggestions={["این بخش را متوجه نشدم، ساده‌تر توضیح بده", "یک مثال دیگر بزن", "چند تمرین دیگر بده"]} />
          )}
        </section>
      )}

      {!editing && <div className="card">{completeBlock}</div>}

      <ConfirmDialog open={confirmRegen} title="تولید مجدد محتوا"
        message="محتوای فعلی این درس، از جمله ویرایش‌های شما، با یک محتوای جدید جایگزین می‌شود. ادامه می‌دهید؟"
        confirmLabel="تولید مجدد" onConfirm={() => { setConfirmRegen(false); void generate(instruction); }} onCancel={() => setConfirmRegen(false)} />
    </div>
  );
}
