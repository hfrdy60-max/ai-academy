import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import ProgressBar from "../components/ProgressBar";
import { useCourse } from "../hooks/useCourses";
import { errMsg } from "../lib/errors";
import { fa } from "../lib/format";
import { courseProgress, nextLesson, removeCourse } from "../services/courseService";
import { levelLabel } from "../types/course";

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { course, loading, error } = useCourse(courseId);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p className="muted" role="status">در حال بارگذاری…</p>;
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>;
  if (!course) {
    return (
      <div className="card text-center">
        <h1 className="font-bold">دوره پیدا نشد</h1>
        <p className="muted mt-2 text-sm">این دوره وجود ندارد یا حذف شده است.</p>
        <Link to="/courses" className="btn btn-primary mt-4">بازگشت به دوره‌های من</Link>
      </div>
    );
  }

  const p = courseProgress(course);
  const next = nextLesson(course);

  async function doDelete() {
    if (!course) return;
    setBusy(true);
    try { await removeCourse(course.id); navigate("/courses"); }
    catch (e) { setActionError(errMsg(e)); setBusy(false); setConfirm(false); }
  }

  return (
    <div className="space-y-5">
      <Link to="/courses" className="muted inline-flex min-h-11 items-center gap-1 text-sm hover:underline">
        <Icon name="back" className="h-4 w-4" />دوره‌های من
      </Link>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold md:text-2xl">{course.title}</h1>
          {course.isDemo && <span className="badge">آزمایشی</span>}
        </div>
        <p className="muted text-sm">{course.subject} · سطح {levelLabel(course.level)}</p>
        {course.description && <p className="text-sm leading-7">{course.description}</p>}
        {course.goal && (
          <div><h2 className="text-sm font-bold">هدف یادگیری</h2><p className="text-sm leading-7">{course.goal}</p></div>
        )}
        <div>
          <ProgressBar value={p.done} max={p.total} label="پیشرفت دوره" />
          <p className="muted mt-1 text-xs">{p.total === 0 ? "این دوره هنوز درسی ندارد." : `${fa(p.done)} از ${fa(p.total)} درس (${fa(p.percent)}٪)`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && (
            <Link to={`/courses/${course.id}/lessons/${next.lessonId}`} className="btn btn-primary">
              <Icon name="play" className="h-4 w-4" />{p.done === 0 ? "شروع یادگیری" : "ادامه یادگیری"}
            </Link>
          )}
          {p.total > 0 && !next && <span className="btn btn-ghost" role="status"><Icon name="check" className="h-4 w-4" />دوره تکمیل شد</span>}
          <Link to={`/courses/${course.id}/edit`} className="btn btn-ghost"><Icon name="edit" className="h-4 w-4" />ویرایش دوره</Link>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}><Icon name="trash" className="h-4 w-4" />حذف دوره</button>
        </div>
        {actionError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{actionError}</p>}
      </section>

      {p.total === 0 ? (
        <section className="card"><p className="muted text-sm">این دوره هنوز فصل یا درسی ندارد. از «ویرایش دوره» فصل و درس اضافه کنید.</p></section>
      ) : (
        <section aria-labelledby="structure" className="space-y-3">
          <h2 id="structure" className="font-bold">فصل‌ها و درس‌ها</h2>
          {course.chapters.map(ch => (
            <div key={ch.id} className="card">
              <h3 className="font-bold">{ch.title}</h3>
              <ol className="mt-2 divide-y divide-slate-200 dark:divide-white/10">
                {ch.lessons.map(l => (
                  <li key={l.id}>
                    <Link to={`/courses/${course.id}/lessons/${l.id}`} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:underline">
                      <span className={l.completed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}><Icon name={l.completed ? "check" : "play"} className="h-4 w-4" /></span>
                      <span>{l.title}</span>
                      <span className="muted ms-auto text-xs">{l.content ? "دارای محتوا · " : ""}{l.completed ? "تکمیل شده" : "انجام نشده"}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      <ConfirmDialog open={confirm} busy={busy} title="حذف دوره"
        message={`دوره «${course.title}» و تمام پیشرفت آن برای همیشه از این دستگاه حذف می‌شود. این کار قابل بازگشت نیست.`}
        confirmLabel="حذف دوره" onConfirm={() => void doDelete()} onCancel={() => setConfirm(false)} />
    </div>
  );
}
