import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { fa } from "../lib/format";
import type { QuizItem } from "../types/course";

type Item = { courseId:string; courseTitle:string; lessonTitle:string; question:QuizItem };
export default function Exams() {
  const { courses, loading, error } = useCourseList();
  const items = useMemo<Item[]>(() => (courses ?? []).flatMap(c => c.chapters.flatMap(ch => ch.lessons.flatMap(l => (l.content?.quiz ?? []).map(question => ({courseId:c.id,courseTitle:c.title,lessonTitle:l.title,question}))))), [courses]);
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [submitted,setSubmitted]=useState(false);
  const correct=items.reduce((n,x,i)=>n+(answers[i]===x.question.correctIndex?1:0),0);
  if(loading) return <p className="muted" role="status">در حال بارگذاری آزمون‌ها…</p>;
  return <div className="mx-auto max-w-3xl space-y-5">
    <header><h1 className="text-xl font-extrabold md:text-2xl">آزمون‌های من</h1><p className="muted mt-1 text-sm">سؤال‌های چهارگزینه‌ای تولیدشده در درس‌های دوره‌هایت را یک‌جا تمرین کن.</p></header>
    {error && <p role="alert" className="card text-sm text-red-700">{error}</p>}
    {items.length===0 ? <section className="card space-y-3"><p className="font-bold">هنوز سؤالی برای آزمون وجود ندارد.</p><p className="muted text-sm">ابتدا یک دوره بساز و برای درس‌های آن محتوا تولید کن؛ اگر محتوای درس آزمون داشته باشد، سؤال‌هایش اینجا نمایش داده می‌شوند.</p><Link className="btn btn-primary" to="/courses">رفتن به دوره‌ها</Link></section> :
    <>
      <section className="card flex flex-wrap items-center justify-between gap-3"><div><p className="muted text-xs">تعداد سؤال‌ها</p><p className="text-2xl font-extrabold">{fa(items.length)}</p></div><div><p className="muted text-xs">پاسخ داده‌شده</p><p className="text-2xl font-extrabold">{fa(Object.keys(answers).length)} / {fa(items.length)}</p></div>{submitted && <div><p className="muted text-xs">نتیجه</p><p className="text-2xl font-extrabold">{fa(correct)} / {fa(items.length)}</p></div>}</section>
      <ol className="space-y-3">{items.map((item,i)=><li className="card space-y-3" key={i}>
        <div><p className="muted text-xs">{item.courseTitle} · {item.lessonTitle}</p><h2 className="mt-1 font-bold leading-7">{fa(i+1)}. {item.question.question}</h2></div>
        <fieldset className="space-y-2" disabled={submitted}><legend className="sr-only">گزینه‌های سؤال {i+1}</legend>{item.question.options.map((option,j)=><label key={j} className={`flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm ${submitted&&j===item.question.correctIndex?"border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10":submitted&&answers[i]===j?"border-red-500": "border-slate-200 dark:border-white/10"}`}><input type="radio" name={`exam-${i}`} checked={answers[i]===j} onChange={()=>setAnswers(a=>({...a,[i]:j}))}/>{option}</label>)}</fieldset>
        {submitted&&<p className="rounded-lg bg-slate-100 p-3 text-sm leading-7 dark:bg-white/10">{answers[i]===item.question.correctIndex?"پاسخ درست است. ":"پاسخ درست گزینه مشخص‌شده است. "}{item.question.explanation}</p>}
      </li>)}</ol>
      <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={Object.keys(answers).length!==items.length||submitted} onClick={()=>setSubmitted(true)}>ثبت و دیدن نتیجه</button>{submitted&&<button className="btn btn-ghost" onClick={()=>{setAnswers({});setSubmitted(false);}}>تکرار آزمون</button>}</div>
      <p className="muted text-xs">نتیجه این آزمون فقط در همین نشست نمایش داده می‌شود و در سوابق ذخیره نمی‌شود.</p>
    </>}
  </div>;
}