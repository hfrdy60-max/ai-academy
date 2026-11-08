import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import { useCourse } from "../hooks/useCourses";
import { errMsg } from "../lib/errors";
import { fa } from "../lib/format";
import { addChapter, addLesson, moveChapter, moveLesson, removeChapter, removeLesson, renameChapter, renameLesson } from "../services/courseEdit";
import { LIMITS, saveCourseEdits } from "../services/courseService";
import { LEVELS } from "../types/course";
import type { Course, Level } from "../types/course";

type Pending = { chapterId: string; lessonId?: string; label: string } | null;

export default function EditCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { course, loading, error } = useCourse(courseId);
  const [draft, setDraft] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [newChapter, setNewChapter] = useState("");
  const [newLesson, setNewLesson] = useState<Record<string, string>>({});

  useEffect(() => { if (course) setDraft(course); }, [course]);

  if (loading) return <p className="muted" role="status">در حال بارگذاری…</p>;
  if (error) return <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>;
  if (!course || !draft) return (
    <div className="card text-center"><h1 className="font-bold">دوره پیدا نشد</h1><Link to="/courses" className="btn btn-primary mt-4">بازگشت به دوره‌های من</Link></div>
  );

  const set = (patch: Partial<Course>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const upd = (fn: (c: Course) => Course) => setDraft(d => (d ? fn(d) : d));

  async function save() {
    if (!draft) return;
    setSaving(true); setSaveError(null);
    try { const saved = await saveCourseEdits(draft); navigate(`/courses/${saved.id}`); }
    catch (e) { setSaveError(errMsg(e)); setSaving(false); }
  }

  function confirmDelete() {
    if (!pending) return;
    upd(c => (pending.lessonId ? removeLesson(c, pending.chapterId, pending.lessonId) : removeChapter(c, pending.chapterId)));
    setPending(null);
  }

  const Lbl = ({ id, children }: { id: string; children: string }) => <label htmlFor={id} className="mb-1 block text-sm font-bold">{children}</label>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/courses/${course.id}`} className="muted inline-flex min-h-11 items-center gap-1 text-sm hover:underline"><Icon name="back" className="h-4 w-4" />بازگشت به دوره</Link>
      <h1 className="text-xl font-extrabold md:text-2xl">ویرایش دوره</h1>

      <section className="card space-y-4" aria-label="اطلاعات دوره">
        <div><Lbl id="ed-title">عنوان دوره *</Lbl><input id="ed-title" className="input" maxLength={LIMITS.title} value={draft.title} onChange={e => set({ title: e.target.value })} /></div>
        <div><Lbl id="ed-subject">موضوع *</Lbl><input id="ed-subject" className="input" maxLength={LIMITS.subject} value={draft.subject} onChange={e => set({ subject: e.target.value })} /></div>
        <div><Lbl id="ed-level">سطح آموزشی</Lbl>
          <select id="ed-level" className="input" value={draft.level} onChange={e => set({ level: e.target.value as Level })}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
        <div><Lbl id="ed-goal">هدف یادگیری</Lbl><textarea id="ed-goal" className="input" rows={2} maxLength={LIMITS.goal} value={draft.goal} onChange={e => set({ goal: e.target.value })} /></div>
        <div><Lbl id="ed-desc">توضیحات</Lbl><textarea id="ed-desc" className="input" rows={3} maxLength={LIMITS.description} value={draft.description} onChange={e => set({ description: e.target.value })} /></div>
      </section>

      <section className="space-y-3" aria-label="فصل‌ها و درس‌ها">
        <h2 className="font-bold">فصل‌ها و درس‌ها</h2>
        {draft.chapters.length === 0 && <p className="muted text-sm">هنوز فصلی ندارید. اولین فصل را اضافه کنید.</p>}
        {draft.chapters.map((ch, ci) => (
          <div key={ch.id} className="card space-y-3">
            <div className="flex items-center gap-2">
              <input className="input font-bold" aria-label={`عنوان فصل ${fa(ci + 1)}`} maxLength={150} value={ch.title} onChange={e => upd(c => renameChapter(c, ch.id, e.target.value))} />
              <button type="button" className="btn btn-ghost !px-3" aria-label={`انتقال فصل ${fa(ci + 1)} به بالا`} disabled={ci === 0} onClick={() => upd(c => moveChapter(c, ch.id, -1))}><Icon name="up" className="h-4 w-4" /></button>
              <button type="button" className="btn btn-ghost !px-3" aria-label={`انتقال فصل ${fa(ci + 1)} به پایین`} disabled={ci === draft.chapters.length - 1} onClick={() => upd(c => moveChapter(c, ch.id, 1))}><Icon name="down" className="h-4 w-4" /></button>
              <button type="button" className="btn btn-ghost !px-3" aria-label={`حذف فصل ${fa(ci + 1)}`} onClick={() => setPending({ chapterId: ch.id, label: `فصل «${ch.title}» با تمام درس‌ها و محتوای آن` })}><Icon name="trash" className="h-4 w-4" /></button>
            </div>
            <ol className="space-y-2">
              {ch.lessons.map((l, li) => (
                <li key={l.id} className="flex items-center gap-2">
                  <input className="input" aria-label={`عنوان درس ${fa(li + 1)} از فصل ${fa(ci + 1)}`} maxLength={150} value={l.title} onChange={e => upd(c => renameLesson(c, ch.id, l.id, e.target.value))} />
                  <button type="button" className="btn btn-ghost !px-3" aria-label={`انتقال درس ${fa(li + 1)} به بالا`} disabled={li === 0} onClick={() => upd(c => moveLesson(c, ch.id, l.id, -1))}><Icon name="up" className="h-4 w-4" /></button>
                  <button type="button" className="btn btn-ghost !px-3" aria-label={`انتقال درس ${fa(li + 1)} به پایین`} disabled={li === ch.lessons.length - 1} onClick={() => upd(c => moveLesson(c, ch.id, l.id, 1))}><Icon name="down" className="h-4 w-4" /></button>
                  <button type="button" className="btn btn-ghost !px-3" aria-label={`حذف درس ${fa(li + 1)} از فصل ${fa(ci + 1)}`} onClick={() => setPending({ chapterId: ch.id, lessonId: l.id, label: `درس «${l.title}»${l.content ? " و محتوای آن" : ""}` })}><Icon name="trash" className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const t = (newLesson[ch.id] ?? "").trim(); if (!t) return; upd(c => addLesson(c, ch.id, t)); setNewLesson(m => ({ ...m, [ch.id]: "" })); }}>
              <input className="input" aria-label={`عنوان درس جدید برای فصل ${fa(ci + 1)}`} placeholder="عنوان درس جدید" maxLength={150} value={newLesson[ch.id] ?? ""} onChange={e => setNewLesson(m => ({ ...m, [ch.id]: e.target.value }))} />
              <button type="submit" className="btn btn-ghost" disabled={!(newLesson[ch.id] ?? "").trim()}><Icon name="plus" className="h-4 w-4" />افزودن درس</button>
            </form>
          </div>
        ))}
        <form className="card flex gap-2" onSubmit={e => { e.preventDefault(); const t = newChapter.trim(); if (!t) return; upd(c => addChapter(c, t)); setNewChapter(""); }}>
          <input className="input" aria-label="عنوان فصل جدید" placeholder="عنوان فصل جدید" maxLength={150} value={newChapter} onChange={e => setNewChapter(e.target.value)} />
          <button type="submit" className="btn btn-ghost" disabled={!newChapter.trim()}><Icon name="plus" className="h-4 w-4" />افزودن فصل</button>
        </form>
      </section>

      {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{saveError}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>{saving ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
        <Link to={`/courses/${course.id}`} className="btn btn-ghost">انصراف</Link>
      </div>
      <p className="muted text-xs">تغییرات تا زمانی که «ذخیره تغییرات» را نزنید ذخیره نمی‌شوند.</p>

      <ConfirmDialog open={pending !== null} title="حذف از دوره" message={pending ? `${pending.label} حذف می‌شود. این تغییر بعد از زدن «ذخیره تغییرات» نهایی می‌شود.` : ""}
        confirmLabel="حذف" onConfirm={confirmDelete} onCancel={() => setPending(null)} />
    </div>
  );
}
