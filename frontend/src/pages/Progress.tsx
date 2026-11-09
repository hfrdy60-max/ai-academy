import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { courseProgress } from "../services/courseService";
import { computeStats, XP_PER_LEVEL } from "../services/stats";
import { fa } from "../lib/format";
import ProgressBar from "../components/ProgressBar";

const BADGES = [
  { at: 1, title: "شروع یادگیری", detail: "تکمیل اولین درس" },
  { at: 5, title: "پنج قدم جلوتر", detail: "تکمیل ۵ درس" },
  { at: 10, title: "یادگیرنده پیگیر", detail: "تکمیل ۱۰ درس" },
  { at: 25, title: "دانش‌پژوه", detail: "تکمیل ۲۵ درس" },
  { at: 50, title: "استاد تلاش", detail: "تکمیل ۵۰ درس" }
];

export default function Progress() {
  const { courses, error } = useCourseList();
  const list = courses ?? [];
  const stats = useMemo(() => computeStats(list), [list]);
  const totals = useMemo(() => list.map(c => ({ course: c, ...courseProgress(c) })), [list]);
  const totalLessons = totals.reduce((n, x) => n + x.total, 0);
  const completed = totals.reduce((n, x) => n + x.done, 0);
  const earned = BADGES.filter(b => stats.totalCompleted >= b.at);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold md:text-2xl">پیشرفت من</h1>
        <p className="muted mt-1 text-sm">گزارش یادگیری بر اساس درس‌هایی که در این دستگاه تکمیل کرده‌اید.</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <section className="card"><p className="muted text-xs">درس‌های تکمیل‌شده</p><p className="mt-2 text-2xl font-extrabold">{fa(completed)}</p></section>
        <section className="card"><p className="muted text-xs">کل درس‌ها</p><p className="mt-2 text-2xl font-extrabold">{fa(totalLessons)}</p></section>
        <section className="card"><p className="muted text-xs">امتیاز</p><p className="mt-2 text-2xl font-extrabold">{fa(stats.xp)} XP</p></section>
        <section className="card"><p className="muted text-xs">سطح فعلی</p><p className="mt-2 text-2xl font-extrabold">{fa(stats.level)}</p></section>
      </div>
      <section className="card">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">پیشرفت کلی</h2><span className="text-sm font-bold">{fa(totalLessons ? Math.round(completed / totalLessons * 100) : 0)}٪</span></div>
        <div className="mt-3"><ProgressBar value={completed} max={totalLessons || 1} label="درصد تکمیل همه دوره‌ها" /></div>
        <p className="muted mt-2 text-xs">برای رسیدن به سطح بعدی {fa(XP_PER_LEVEL - stats.xpInLevel)} امتیاز دیگر لازم دارید.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="font-bold">پیشرفت دوره‌ها</h2>
        {totals.length === 0 ? <p className="muted text-sm">هنوز دوره‌ای نساخته‌اید. <Link className="text-indigo-600 underline dark:text-indigo-300" to="/create">ساخت اولین دوره</Link></p> :
          totals.map(({ course, done, total, percent }) => <div key={course.id}><div className="mb-1 flex justify-between gap-2 text-sm"><Link to={`/courses/${course.id}`} className="font-semibold hover:underline">{course.title}</Link><span className="muted">{fa(done)} از {fa(total)}</span></div><ProgressBar value={done} max={total || 1} label={`پیشرفت ${course.title}`} /><p className="muted mt-1 text-left text-xs">{fa(percent)}٪</p></div>)
        }
      </section>
      <section className="card">
        <h2 className="font-bold">نشان‌های یادگیری</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {BADGES.map(b => { const unlocked = stats.totalCompleted >= b.at; return <div key={b.at} className={`rounded-xl border p-3 ${unlocked ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 opacity-60 dark:border-white/10"}`}><p className="font-bold">{unlocked ? "🏅 " : "🔒 "}{b.title}</p><p className="muted mt-1 text-xs">{b.detail}</p></div>; })}
        </div>
        <p className="muted mt-3 text-xs">{fa(earned.length)} نشان از {fa(BADGES.length)} نشان دریافت شده است.</p>
      </section>
    </div>
  );
}
