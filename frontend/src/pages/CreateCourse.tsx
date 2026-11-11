import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errMsg } from "../lib/errors";
import { fa } from "../lib/format";
import { AiError, generateOutline } from "../services/aiClient";
import { createCourse, LIMITS } from "../services/courseService";
import { getAiSettings } from "../services/settingsService";
import { LEVELS } from "../types/course";
import type { Level } from "../types/course";

type Structure = "ai" | "sample" | "none";
type CourseDraft = { title: string; subject: string; description: string; goal: string; level: Level; structure: Structure };
const DRAFT_KEY = "ai-academy-course-draft";
function readCourseDraft(): CourseDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.title !== "string" || typeof d.subject !== "string") return null;
    return {
      title: d.title.slice(0, LIMITS.title), subject: d.subject.slice(0, LIMITS.subject),
      description: typeof d.description === "string" ? d.description.slice(0, LIMITS.description) : "",
      goal: typeof d.goal === "string" ? d.goal.slice(0, LIMITS.goal) : "",
      level: d.level === "advanced" || d.level === "intermediate" ? d.level : "beginner",
      structure: "ai"
    };
  } catch { return null; }
}

export default function CreateCourse() {
  const navigate = useNavigate();
  const [draft] = useState<CourseDraft | null>(() => readCourseDraft());
  useEffect(() => { if (draft) sessionStorage.removeItem(DRAFT_KEY); }, [draft]);
  const [title, setTitle] = useState(() => draft?.title ?? "");
  const [subject, setSubject] = useState(() => draft?.subject ?? "");
  const [description, setDescription] = useState(() => draft?.description ?? "");
  const [goal, setGoal] = useState(() => draft?.goal ?? "");
  const [level, setLevel] = useState<Level>(() => draft?.level ?? "beginner");
  const [structure, setStructure] = useState<Structure>(() => draft?.structure ?? "sample");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);
  const curriculumSize = { beginner: { chapters: 5, lessons: 25 }, intermediate: { chapters: 10, lessons: 50 }, advanced: { chapters: 20, lessons: 100 } }[level];

  // If the AI connection is already set up, suggest AI-generated structure by default.
  useEffect(() => {
    getAiSettings().then(s => { if (!touched.current && s.workerUrl && s.accessToken) setStructure("ai"); }).catch(() => {});
  }, []);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSaving(true); setError(null); setStatus(null);
    try {
      let outline: { title: string; lessons: string[] }[] | undefined;
      if (structure === "ai") {
        if (!title.trim() || !subject.trim()) throw new Error(!title.trim() ? "عنوان دوره را وارد کنید." : "موضوع دوره را وارد کنید.");
        setStatus("در حال طراحی فصل‌ها و درس‌ها با هوش مصنوعی… ممکن است تا یک دقیقه طول بکشد.");
        outline = (await generateOutline({ title: title.trim(), subject: subject.trim(), level, goal: goal.trim(), description: description.trim() })).data.chapters;
      }
      const course = await createCourse({ title, subject, description, goal, level, withSampleStructure: structure === "sample", outline });
      navigate(`/courses/${course.id}`);
    } catch (err) {
      setError(err instanceof AiError ? err.message : errMsg(err));
      setStatus(null);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold md:text-2xl">ساخت دوره جدید</h1>
      {draft && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" role="status">مشخصات دوره از گفتگوی معلم هوشمند وارد شد. قبل از ساخت، آن‌ها را بررسی و در صورت نیاز ویرایش کنید.</p>}
      <p className="muted text-sm leading-7">عنوان و موضوع را بنویسید. می‌توانید فصل‌ها و درس‌ها را هوش مصنوعی طراحی کند یا بعداً خودتان در «ویرایش دوره» بسازید.</p>

      <form onSubmit={e => void submit(e)} className="card space-y-4" noValidate>
        <div>
          <label htmlFor="c-title" className="mb-1 block text-sm font-bold">عنوان دوره <span aria-hidden="true">*</span></label>
          <input id="c-title" className="input" value={title} maxLength={LIMITS.title} required aria-required="true"
                 onChange={e => setTitle(e.target.value)} placeholder="مثلاً: آشنایی با سیستم جرقه خودرو" />
        </div>
        <div>
          <label htmlFor="c-subject" className="mb-1 block text-sm font-bold">موضوع <span aria-hidden="true">*</span></label>
          <input id="c-subject" className="input" value={subject} maxLength={LIMITS.subject} required aria-required="true"
                 onChange={e => setSubject(e.target.value)} placeholder="مثلاً: برق خودرو" />
        </div>
        <div>
          <label htmlFor="c-level" className="mb-1 block text-sm font-bold">سطح آموزشی</label>
          <select id="c-level" className="input" value={level} onChange={e => setLevel(e.target.value as Level)}>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <p className="muted mt-1 text-xs">ساختار خودکار این سطح: {fa(curriculumSize.chapters)} فصل و {fa(curriculumSize.lessons)} درس؛ هر فصل دقیقاً ۵ درس دارد.</p>
        </div>
        <div>
          <label htmlFor="c-goal" className="mb-1 block text-sm font-bold">هدف یادگیری</label>
          <textarea id="c-goal" className="input" rows={3} value={goal} maxLength={LIMITS.goal}
                    onChange={e => setGoal(e.target.value)} placeholder="بعد از این دوره می‌خواهم بتوانم…" />
        </div>
        <div>
          <label htmlFor="c-desc" className="mb-1 block text-sm font-bold">توضیحات</label>
          <textarea id="c-desc" className="input" rows={3} value={description} maxLength={LIMITS.description}
                    onChange={e => setDescription(e.target.value)} />
          <p className="muted mt-1 text-xs">حداکثر {fa(LIMITS.description)} حرف</p>
        </div>
        <div>
          <label htmlFor="c-structure" className="mb-1 block text-sm font-bold">ساختار فصل‌ها و درس‌ها</label>
          <select id="c-structure" className="input" value={structure} onChange={e => { touched.current = true; setStructure(e.target.value as Structure); }}>
            <option value="ai">طراحی خودکار با هوش مصنوعی (نیاز به اتصال)</option>
            <option value="sample">ساختار آزمایشی (۳ فصل و ۶ درس با عنوان کلی)</option>
            <option value="none">خالی (خودم اضافه می‌کنم)</option>
          </select>
        </div>

        {status && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-400/10">{status}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}

        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saving}>{saving ? "در حال ساخت…" : "ساخت و ذخیره دوره"}</button>
      </form>
    </div>
  );
}
