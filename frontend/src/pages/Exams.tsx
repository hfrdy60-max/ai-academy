import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { fa } from "../lib/format";
import type { QuizItem } from "../types/course";

type Item = { courseId:string; courseTitle:string; lessonTitle:string; question:QuizItem };
type ExamResult = { id:string; date:number; correct:number; total:number; percent:number };
const RESULTS_KEY = "ai-academy:exam-results:v1";
function readResults(): ExamResult[] {
  try { const value = localStorage.getItem(RESULTS_KEY); const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id==="string" && typeof x.date==="number" && typeof x.correct==="number" && typeof x.total==="number" && typeof x.percent==="number").slice(0,20) : []; }
  catch { return []; }
}
export default function Exams() {
  const { courses, error } = useCourseList();
  const items = useMemo<Item[]>(() => (courses ?? []).flatMap(c => c.chapters.flatMap(ch => ch.lessons.flatMap(l => (l.content?.quiz ?? []).map(question => ({courseId:c.id,courseTitle:c.title,lessonTitle:l.title,question}))))), [courses]);
  const [selectedCourse,setSelectedCourse]=useState("all");
  const filteredItems = useMemo(() => selectedCourse === "all" ? items : items.filter(x => x.courseId === selectedCourse), [items, selectedCourse]);
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [submitted,setSubmitted]=useState(false);
  const [history,setHistory]=useState<ExamResult[]>(readResults);
  const correct=filteredItems.reduce((n,x,i)=>n+(answers[i]===x.question.correctIndex?1:0),0);
  function submit(){
    if(Object.keys(answers).length!==filteredItems.length || submitted || !filteredItems.length) return;
    const result:ExamResult={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,date:Date.now(),correct,total:filteredItems.length,percent:Math.round(correct/filteredItems.length*100)};
    const next=[result,...history].slice(0,20);
    try { localStorage.setItem(RESULTS_KEY,JSON.stringify(next)); setHistory(next); } catch { /* Results remain visible for this session if storage is unavailable. */ }
    setSubmitted(true);
  }
  if(courses===null) return <p className="muted" role="status">در حال بارگذاری آزمون‌ها…</p>;
  return <div className="mx-auto max-w-3xl space-y-5">
    <header><h1 className="text-xl font-extrabold md:text-2xl">آزمون‌های من</h1><p className="muted mt-1 text-sm">از یک دوره مشخص یا همه دوره‌ها آزمون بگیر و نتیجه را در همین دستگاه نگه دار.</p></header>
    <section className="card space-y-2"><label htmlFor="exam-course" className="block text-sm font-bold">انتخاب دوره</label><select id="exam-course" className="input" value={selectedCourse} disabled={submitted} onChange={e=>{setSelectedCourse(e.target.value);setAnswers({});}}><option value="all">همه دوره‌ها</option>{(courses??[]).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><p className="muted text-xs">با تغییر دوره، پاسخ‌های آزمون فعلی پاک می‌شوند.</p></section>
    {error && <p role="alert" className="card text-sm text-red-700">{error}</p>}
    {filteredItems.length===0 ? <section className="card space-y-3"><p className="font-bold">هنوز سؤالی برای آزمون وجود ندارد.</p><p className="muted text-sm">ابتدا یک دوره بساز و برای درس‌های آن محتوا تولید کن؛ اگر محتوای درس آزمون داشته باشد، سؤال‌هایش اینجا نمایش داده می‌شوند.</p><Link className="btn btn-primary" to="/courses">رفتن به دوره‌ها</Link></section> :
    <>
      <section className="card flex flex-wrap items-center justify-between gap-3"><div><p className="muted text-xs">تعداد سؤال‌ها</p><p className="text-2xl font-extrabold">{fa(filteredItems.length)}</p></div><div><p className="muted text-xs">پاسخ داده‌شده</p><p className="text-2xl font-extrabold">{fa(Object.keys(answers).length)} / {fa(filteredItems.length)}</p></div>{submitted && <div><p className="muted text-xs">نتیجه</p><p className="text-2xl font-extrabold">{fa(correct)} / {fa(items.length)}</p></div>}</section>
      <ol className="space-y-3">{filteredItems.map((item,i)=><li className="card space-y-3" key={`${item.courseId}-${item.lessonTitle}-${i}`}>
        <div><p className="muted text-xs">{item.courseTitle} · {item.lessonTitle}</p><h2 className="mt-1 font-bold leading-7">{fa(i+1)}. {item.question.question}</h2></div>
        <fieldset className="space-y-2" disabled={submitted}><legend className="sr-only">گزینه‌های سؤال {i+1}</legend>{item.question.options.map((option,j)=><label key={j} className={`flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm ${submitted&&j===item.question.correctIndex?"border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10":submitted&&answers[i]===j?"border-red-500": "border-slate-200 dark:border-white/10"}`}><input type="radio" name={`exam-${i}`} checked={answers[i]===j} onChange={()=>setAnswers(a=>({...a,[i]:j}))}/>{option}</label>)}</fieldset>
        {submitted&&<p className="rounded-lg bg-slate-100 p-3 text-sm leading-7 dark:bg-white/10">{answers[i]===item.question.correctIndex?"پاسخ درست است. ":"پاسخ درست گزینه مشخص‌شده است. "}{item.question.explanation}</p>}
      </li>)}</ol>
      <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={Object.keys(answers).length!==filteredItems.length||submitted} onClick={submit}>ثبت و دیدن نتیجه</button>{submitted&&<button className="btn btn-ghost" onClick={()=>{setAnswers({});setSubmitted(false);}}>تکرار آزمون</button>}</div>
    </>}
    <section className="card space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-bold">سوابق آزمون</h2><span className="muted text-xs">آخرین ۲۰ نتیجه · ذخیره روی همین دستگاه</span></div>
      {history.length===0?<p className="muted text-sm">هنوز آزمونی ثبت نکرده‌ای.</p>:<ol className="divide-y divide-slate-200 dark:divide-white/10">{history.map((result)=><li key={result.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{new Date(result.date).toLocaleString("fa-IR")}</p><p className="muted mt-1">{fa(result.correct)} پاسخ درست از {fa(result.total)}</p></div><strong className="text-lg">{fa(result.percent)}٪</strong></li>)}</ol>}
    </section>
  </div>;
}