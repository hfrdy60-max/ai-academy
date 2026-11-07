import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { fa } from "../lib/format";
import type { IconName } from "../types/nav";

// NOTE: Milestone 1 has no data layer yet, so every value below is the honest
// "nothing recorded yet" state. Milestones 2 and 6 replace these with real data.
const xp = 0;
const level = 1;
const dailyDone = 0;
const dailyGoal = 1;

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
         className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

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
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-l from-indigo-700 to-violet-700 p-5 text-white md:p-8">
        <h1 className="text-xl font-extrabold leading-snug md:text-3xl">به آکادمی هوش مصنوعی خوش آمدید</h1>
        <p className="mt-2 max-w-xl text-sm text-indigo-100 md:text-base">
          هر موضوعی را بنویسید؛ دوره کامل با درس، تمرین، بازی و آزمون می‌سازیم.
        </p>
        <Link to="/create" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold text-indigo-700">
          <Icon name="sparkles" className="h-4 w-4" />ساخت اولین دوره
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <div className="col-span-2 md:col-span-1">
          <Stat icon="book" title="ادامه یادگیری">
            <p className="muted mt-2 text-sm">هنوز درسی شروع نشده است.</p>
          </Stat>
        </div>
        <Stat icon="trophy" title="امتیاز و سطح">
          <p className="mt-2 text-lg font-extrabold">{fa(xp)} <span className="text-sm font-medium">امتیاز</span></p>
          <p className="muted text-sm">سطح {fa(level)}</p>
        </Stat>
        <Stat icon="target" title="هدف روزانه">
          <p className="mt-2 text-lg font-extrabold">{fa(dailyDone)} از {fa(dailyGoal)} <span className="text-sm font-medium">درس</span></p>
          <Progress value={dailyDone} max={dailyGoal} label="پیشرفت هدف روزانه" />
        </Stat>
      </div>

      <section className="card" aria-labelledby="my-courses">
        <h2 id="my-courses" className="font-bold">دوره‌های من</h2>
        <p className="muted mt-2 text-sm">هنوز دوره‌ای ندارید. ذخیره‌سازی و مدیریت دوره‌ها در نقطه عطف ۲ اضافه می‌شود.</p>
      </section>

      <section className="card" aria-labelledby="achievements">
        <h2 id="achievements" className="font-bold">دستاوردها</h2>
        <p className="muted mt-2 text-sm">با تکمیل درس‌ها و آزمون‌ها نشان دریافت می‌کنید.</p>
      </section>
    </div>
  );
}
