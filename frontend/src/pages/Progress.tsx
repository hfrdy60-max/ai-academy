import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { courseProgress } from "../services/courseService";
import { computeStats, XP_PER_LEVEL } from "../services/stats";
import { fa } from "../lib/format";
import ProgressBar from "../components/ProgressBar";
import { readExamHistory, readGameHistory } from "../services/resultService";

const BADGES = [
  { at: 1, title: "شروع یادگیری", detail: "تکمیل اولین درس" },
  { at: 5, title: "پنج قدم جلوتر", detail: "تکمیل ۵ درس" },
  { at: 10, title: "یادگیرنده پیگیر", detail: "تکمیل ۱۰ درس" },
  { at: 25, title: "دانش‌پژوه", detail: "تکمیل ۲۵ درس" },
  { at: 50, title: "استاد تلاش", detail: "تکمیل ۵۰ درس" }
];

function printCertificate(title: string, subject: string, completedAt: string) {
  const popup = window.open("", "_blank");
  if (!popup) {
    window.alert("مرورگر اجازه باز کردن پنجره گواهی را نداد. پنجره‌های بازشو را برای این سایت مجاز کنید.");
    return;
  }
  popup.opener = null;
  const safe = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
  popup.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>گواهی یادگیری</title><style>
    *{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#172554;font-family:Tahoma,Arial,sans-serif}.paper{max-width:900px;min-height:580px;margin:4vh auto;padding:56px 42px;border:10px double #64748b;background:white;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:22px}.label{font-size:18px;color:#475569}.title{font-size:34px;font-weight:bold;line-height:1.7}.course{font-size:27px;font-weight:bold;color:#4338ca}.meta{font-size:15px;color:#475569}.disclaimer{font-size:12px;color:#64748b;margin-top:20px}@media print{body{padding:0;background:white}.paper{margin:0;max-width:none;min-height:100vh;break-inside:avoid}}
    </style></head><body><main class="paper"><div class="label">آکادمی هوش مصنوعی</div><div class="title">گواهی پایان دوره</div><div class="label">این گواهی نشان می‌دهد که دوره آموزشی زیر در این برنامه به پایان رسیده است:</div><div class="course">${safe(title)}</div><div class="label">حوزه آموزشی: ${safe(subject)}</div><div class="meta">تاریخ تکمیل: ${safe(completedAt)}</div><div class="disclaimer">این گواهی خودکار و غیررسمی است و مدرک تحصیلی یا گواهی معتبر سازمانی محسوب نمی‌شود.</div></main><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  popup.document.close();
}

export default function Progress() {
  const { courses, error } = useCourseList();
  const list = courses ?? [];
  const stats = useMemo(() => computeStats(list), [list]);
  const totals = useMemo(() => list.map(c => ({ course: c, ...courseProgress(c) })), [list]);
  const [examResults, setExamResults] = useState(readExamHistory);
  const [gameResults, setGameResults] = useState(readGameHistory);
  useEffect(() => {
    const refresh = () => { setExamResults(readExamHistory()); setGameResults(readGameHistory()); };
    window.addEventListener("ai-academy-results-change", refresh);
    return () => window.removeEventListener("ai-academy-results-change", refresh);
  }, []);
  const totalLessons = totals.reduce((n, x) => n + x.total, 0);
  const completed = totals.reduce((n, x) => n + x.done, 0);
  const earned = BADGES.filter(b => stats.totalCompleted >= b.at);
  const bestExam = examResults.reduce((best, x) => Math.max(best, x.percent), 0);
  const bestGame = gameResults.reduce((best, x) => Math.max(best, x.points), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold md:text-2xl">پیشرفت من</h1>
        <p className="muted mt-1 text-sm">گزارش یادگیری بر اساس دوره‌ها، سوابق آزمون و بازی؛ اطلاعات با حساب کاربری همگام می‌شوند.</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <section className="card"><p className="muted text-xs">درس‌های تکمیل‌شده</p><p className="mt-2 text-2xl font-extrabold">{fa(completed)}</p></section>
        <section className="card"><p className="muted text-xs">کل درس‌ها</p><p className="mt-2 text-2xl font-extrabold">{fa(totalLessons)}</p></section>
        <section className="card"><p className="muted text-xs">امتیاز یادگیری</p><p className="mt-2 text-2xl font-extrabold">{fa(stats.xp)} XP</p></section>
        <section className="card"><p className="muted text-xs">سطح فعلی</p><p className="mt-2 text-2xl font-extrabold">{fa(stats.level)}</p></section>
      </div>
      <section className="card">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">پیشرفت کلی</h2><span className="text-sm font-bold">{fa(totalLessons ? Math.round(completed / totalLessons * 100) : 0)}٪</span></div>
        <div className="mt-3"><ProgressBar value={completed} max={totalLessons || 1} label="درصد تکمیل همه دوره‌ها" /></div>
        <p className="muted mt-2 text-xs">برای رسیدن به سطح بعدی {fa(XP_PER_LEVEL - stats.xpInLevel)} امتیاز دیگر لازم دارید.</p>
      </section>
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-bold">عملکرد آزمون و بازی</h2><div className="flex gap-3 text-xs"><Link className="text-indigo-600 underline dark:text-indigo-300" to="/exams">آزمون‌ها</Link><Link className="text-indigo-600 underline dark:text-indigo-300" to="/games">بازی‌ها</Link></div></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5"><p className="muted text-xs">تعداد آزمون‌ها</p><p className="mt-1 text-xl font-extrabold">{fa(examResults.length)}</p><p className="muted mt-1 text-xs">بهترین نمره: {fa(bestExam)}٪</p></div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5"><p className="muted text-xs">بازی‌های ثبت‌شده</p><p className="mt-1 text-xl font-extrabold">{fa(gameResults.length)}</p><p className="muted mt-1 text-xs">بالاترین امتیاز: {fa(bestGame)}</p></div>
        </div>
        <p className="muted text-xs">با ورود به حساب، سوابق آزمون و بازی نیز مانند دوره‌ها بین دستگاه‌ها همگام‌سازی می‌شوند.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="font-bold">پیشرفت دوره‌ها</h2>
        {totals.length === 0 ? <p className="muted text-sm">هنوز دوره‌ای نساخته‌اید. <Link className="text-indigo-600 underline dark:text-indigo-300" to="/create">ساخت اولین دوره</Link></p> :
          totals.map(({ course, done, total, percent }) => <div key={course.id} className="space-y-2"><div className="mb-1 flex justify-between gap-2 text-sm"><Link to={`/courses/${course.id}`} className="font-semibold hover:underline">{course.title}</Link><span className="muted">{fa(done)} از {fa(total)}</span></div><ProgressBar value={done} max={total || 1} label={`پیشرفت ${course.title}`} /><div className="flex flex-wrap items-center justify-between gap-2"><p className="muted text-xs">{fa(percent)}٪</p>{total > 0 && done === total && <button type="button" className="btn btn-ghost text-xs" onClick={() => printCertificate(course.title, course.subject, new Date(course.updatedAt).toLocaleDateString("fa-IR"))}>چاپ گواهی پایان دوره</button>}</div></div>)
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
