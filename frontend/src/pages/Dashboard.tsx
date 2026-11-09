import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import ProgressBar from "../components/ProgressBar";
import { useCourseList } from "../hooks/useCourses";
import { fa } from "../lib/format";
import { courseProgress, nextLesson } from "../services/courseService";
import { getProfile } from "../services/settingsService";
import { computeStats, XP_PER_LEVEL } from "../services/stats";
import type { IconName } from "../types/nav";
import type { Profile } from "../types/settings";

function Stat({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
        <Icon name={icon} className="h-4 w-4" />{title}
      </h2>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { courses } = useCourseList();
  const [profile, setProfile] = useState<Profile>({ displayName: "", dailyGoal: 1 });
  useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);

  const list = courses ?? [];
  const stats = computeStats(list);
  const current = list.find(c => nextLesson(c) !== null && courseProgress(c).total > 0);
  const currentNext = current ? nextLesson(current) : null;
  const goalDone = Math.min(stats.todayDone, profile.dailyGoal);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-l from-indigo-700 to-violet-700 p-5 text-white md:p-8">
        <h1 className="text-xl font-extrabold leading-snug md:text-3xl">{profile.displayName ? `سلام ${profile.displayName}، خوش آمدید` : "به آکادمی هوش مصنوعی خوش آمدید"}</h1>
        <p className="mt-2 max-w-xl text-sm text-indigo-100 md:text-base">
          هر موضوعی را بنویسید؛ دوره کامل با درس، تمرین و آزمون می‌سازیم و معلم هوشمند کنار شماست.
        </p>
        {courses !== null && list.length === 0 && (
          <Link to="/create" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold text-indigo-700">
            <Icon name="sparkles" className="h-4 w-4" />ساخت اولین دوره
          </Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <div className="col-span-2 md:col-span-1">
          <Stat icon="book" title="ادامه یادگیری">
            {current && currentNext ? (
              <>
                <p className="mt-2 text-sm font-bold">{current.title}</p>
                <p className="muted text-xs">{currentNext.title}</p>
                <Link to={`/courses/${current.id}/lessons/${currentNext.lessonId}`} className="btn btn-primary mt-3 w-full">ادامه یادگیری</Link>
              </>
            ) : (
              <p className="muted mt-2 text-sm">درس نیمه‌تمامی ندارید.</p>
            )}
          </Stat>
        </div>
        <Stat icon="trophy" title="امتیاز و سطح">
          <p className="mt-2 text-lg font-extrabold">{fa(stats.xp)} <span className="text-sm font-medium">امتیاز</span></p>
          <p className="muted text-sm">سطح {fa(stats.level)}</p>
          <div className="mt-2"><ProgressBar value={stats.xpInLevel} max={XP_PER_LEVEL} label="پیشرفت تا سطح بعد" /></div>
        </Stat>
        <Stat icon="target" title="هدف روزانه">
          <p className="mt-2 text-lg font-extrabold">{fa(goalDone)} از {fa(profile.dailyGoal)} <span className="text-sm font-medium">درس</span></p>
          <div className="mt-3"><ProgressBar value={goalDone} max={profile.dailyGoal} label="پیشرفت هدف روزانه" /></div>
        </Stat>
      </div>

      <section className="card" aria-labelledby="my-courses">
        <div className="flex items-center justify-between gap-2">
          <h2 id="my-courses" className="font-bold">دوره‌های من</h2>
          <Link to="/courses" className="text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">همه دوره‌ها</Link>
        </div>
        {courses !== null && list.length === 0 && <p className="muted mt-2 text-sm">هنوز دوره‌ای ندارید. یک دوره بسازید.</p>}
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-white/10">
          {list.slice(0, 3).map(c => {
            const p = courseProgress(c);
            return (
              <li key={c.id} className="py-3">
                <Link to={`/courses/${c.id}`} className="block text-sm font-bold hover:underline">{c.title}</Link>
                <div className="mt-2"><ProgressBar value={p.done} max={p.total} label={`پیشرفت ${c.title}`} /></div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card space-y-3" aria-labelledby="achievements">
        <div className="flex items-center justify-between gap-2">
          <h2 id="achievements" className="font-bold">دستاوردها</h2>
          <Link to="/progress" className="text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">گزارش کامل</Link>
        </div>
        <p className="muted text-sm">{stats.totalCompleted > 0 ? `تا امروز ${fa(stats.totalCompleted)} درس را تکمیل کرده‌اید و ${fa(stats.xp)} امتیاز گرفته‌اید.` : "با تکمیل درس‌ها امتیاز می‌گیرید و نشان‌های یادگیری آزاد می‌شوند."}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Link to="/exams" className="btn btn-ghost justify-center">شرکت در آزمون</Link>
          <Link to="/games" className="btn btn-ghost justify-center">بازی آموزشی</Link>
          <Link to="/progress" className="btn btn-ghost col-span-2 justify-center sm:col-span-1">مشاهده پیشرفت</Link>
        </div>
      </section>
    </div>
  );
}
