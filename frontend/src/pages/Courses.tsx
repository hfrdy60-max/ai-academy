import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CourseCard from "../components/CourseCard";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import { useCourseList } from "../hooks/useCourses";
import { errMsg } from "../lib/errors";
import { removeCourse, seedDemoCourses } from "../services/courseService";
import { LEVELS } from "../types/course";
import type { Course, Level } from "../types/course";

export default function Courses() {
  const { courses, error, reload } = useCourseList();
  const [toDelete, setToDelete] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"" | Level>("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const subjects = useMemo(() => Array.from(new Set((courses ?? []).map(c => c.subject))).sort((a, b) => a.localeCompare(b, "fa")), [courses]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (courses ?? []).filter(c =>
      (!levelFilter || c.level === levelFilter) && (!subjectFilter || c.subject === subjectFilter) &&
      (!q || [c.title, c.subject, c.goal, c.description].some(t => t.toLowerCase().includes(q))));
  }, [courses, query, levelFilter, subjectFilter]);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try { await removeCourse(toDelete.id); await reload(); setActionError(null); }
    catch (e) { setActionError(errMsg(e)); }
    finally { setBusy(false); setToDelete(null); }
  }

  async function addDemos() {
    try { await seedDemoCourses(); await reload(); setActionError(null); }
    catch (e) { setActionError(errMsg(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold md:text-2xl">دوره‌های من</h1>
        <Link to="/create" className="btn btn-primary"><Icon name="plus" className="h-4 w-4" />ساخت دوره جدید</Link>
      </div>

      {(error || actionError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error ?? actionError}</p>}

      {courses === null && <p className="muted" role="status">در حال بارگذاری…</p>}

      {courses !== null && courses.length === 0 && !error && (
        <section className="card text-center">
          <h2 className="font-bold">هنوز دوره‌ای ندارید</h2>
          <p className="muted mt-2 text-sm">یک دوره بسازید، یا برای آزمایش برنامه چند دوره نمونه اضافه کنید.</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to="/create" className="btn btn-primary">ساخت دوره جدید</Link>
            <button type="button" className="btn btn-ghost" onClick={() => void addDemos()}>افزودن دوره‌های آزمایشی</button>
          </div>
        </section>
      )}

      {courses !== null && courses.length > 0 && (
        <>
          <div className="card grid gap-3 sm:grid-cols-3" role="search" aria-label="جست‌وجو و دسته‌بندی دوره‌ها">
            <div className="sm:col-span-1">
              <label htmlFor="f-q" className="mb-1 block text-sm font-bold">جست‌وجو</label>
              <input id="f-q" type="search" className="input" placeholder="عنوان، موضوع یا هدف…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div>
              <label htmlFor="f-level" className="mb-1 block text-sm font-bold">سطح</label>
              <select id="f-level" className="input" value={levelFilter} onChange={e => setLevelFilter(e.target.value as "" | Level)}>
                <option value="">همه سطح‌ها</option>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-subject" className="mb-1 block text-sm font-bold">دسته (موضوع)</label>
              <select id="f-subject" className="input" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                <option value="">همه موضوع‌ها</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="muted" role="status">دوره‌ای با این جست‌وجو پیدا نشد.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(c => <CourseCard key={c.id} course={c} onDelete={setToDelete} />)}
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => void addDemos()}>افزودن دوره‌های آزمایشی</button>
        </>
      )}

      <ConfirmDialog open={toDelete !== null} busy={busy} title="حذف دوره"
        message={toDelete ? `دوره «${toDelete.title}» و تمام پیشرفت آن برای همیشه از این دستگاه حذف می‌شود. این کار قابل بازگشت نیست.` : ""}
        confirmLabel="حذف دوره" onConfirm={() => void confirmDelete()} onCancel={() => setToDelete(null)} />
    </div>
  );
}
