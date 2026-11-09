import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { fa } from "../lib/format";
import type { QuizItem } from "../types/course";
type Card={courseTitle:string;lessonTitle:string;q:QuizItem};
type GameRecord={id:string;date:number;points:number;correct:number;answered:number;bestStreak:number};
const KEY="ai-academy:game-results:v1";
function readHistory():GameRecord[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v.filter(x=>x&&typeof x.id==="string"&&typeof x.date==="number"&&typeof x.points==="number"&&typeof x.correct==="number"&&typeof x.answered==="number"&&typeof x.bestStreak==="number").slice(0,20):[];}catch{return[];}}
export default function Games(){
 const {courses,error}=useCourseList();
 const deck=useMemo<Card[]>(()=> (courses??[]).flatMap(c=>c.chapters.flatMap(ch=>ch.lessons.flatMap(l=>(l.content?.quiz??[]).map(q=>({courseTitle:c.title,lessonTitle:l.title,q}))))),[courses]);
 const [order,setOrder]=useState(0); const [picked,setPicked]=useState<number|null>(null); const [points,setPoints]=useState(0); const [streak,setStreak]=useState(0); const [bestStreak,setBestStreak]=useState(0); const [correct,setCorrect]=useState(0); const [answeredCount,setAnsweredCount]=useState(0); const [answered,setAnswered]=useState(false); const [history,setHistory]=useState<GameRecord[]>(readHistory); const [saved,setSaved]=useState(false);
 const current=deck.length?deck[order%deck.length]:null;
 function answer(i:number){if(answered||!current)return;setPicked(i);setAnswered(true);setAnsweredCount(n=>n+1);if(i===current.q.correctIndex){setPoints(p=>p+10);setCorrect(n=>n+1);setStreak(s=>{const next=s+1;setBestStreak(b=>Math.max(b,next));return next;});}else setStreak(0);}
 function finish(){if(saved||answeredCount===0)return;const record:GameRecord={id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:Date.now(),points,correct,answered:answeredCount,bestStreak};const next=[record,...history].slice(0,20);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* keep this session's result visible */}setHistory(next);setSaved(true);}
 function next(){setOrder(o=>o+1);setPicked(null);setAnswered(false);}
 function restart(){setOrder(0);setPicked(null);setPoints(0);setStreak(0);setBestStreak(0);setCorrect(0);setAnsweredCount(0);setAnswered(false);setSaved(false);}
 if(courses===null)return <p className="muted" role="status">در حال آماده‌سازی بازی…</p>;
 return <div className="mx-auto max-w-2xl space-y-5">
  <header><h1 className="text-xl font-extrabold md:text-2xl">بازی‌های آموزشی</h1><p className="muted mt-1 text-sm">در چالش دانشی شرکت کن، امتیاز بگیر و زنجیره پاسخ‌های درست بساز.</p></header>
  {error&&<p role="alert" className="card text-sm text-red-700">{error}</p>}
  {!current?<section className="card space-y-3"><p className="font-bold">برای شروع بازی هنوز سؤالی نداریم.</p><p className="muted text-sm">برای درس‌های دوره‌ها محتوا و آزمون تولید کن تا کارت‌های بازی ساخته شوند.</p><Link className="btn btn-primary" to="/create">ساخت دوره</Link></section>:
  <>
   <div className="grid grid-cols-3 gap-3"><section className="card"><p className="muted text-xs">امتیاز</p><p className="text-2xl font-extrabold">{fa(points)}</p></section><section className="card"><p className="muted text-xs">پشت‌سرهم</p><p className="text-2xl font-extrabold">{fa(streak)}</p></section><section className="card"><p className="muted text-xs">سؤال</p><p className="text-2xl font-extrabold">{fa(order+1)}</p></section></div>
   <section className="card space-y-4"><div><p className="muted text-xs">{current.courseTitle} · {current.lessonTitle}</p><h2 className="text-lg font-bold leading-8">{current.q.question}</h2></div>
    <div className="grid gap-2">{current.q.options.map((o,i)=><button key={i} disabled={answered||saved} onClick={()=>answer(i)} className={`min-h-12 rounded-xl border p-3 text-right text-sm ${answered&&i===current.q.correctIndex?"border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10":answered&&picked===i?"border-red-500":"border-slate-200 dark:border-white/10"}`}>{o}</button>)}</div>
    {answered&&<div className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm leading-7 dark:bg-white/10"><p className="font-bold">{picked===current.q.correctIndex?"آفرین! ۱۰ امتیاز گرفتی.":"این بار درست نبود؛ دفعه بعد تلاش کن."}</p><p>{current.q.explanation}</p><div className="flex flex-wrap gap-2"><button className="btn btn-primary" onClick={next}>سؤال بعدی</button><button className="btn btn-ghost" onClick={finish}>پایان و ذخیره نتیجه</button></div></div>}
    {saved&&<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">نتیجه بازی در این دستگاه ذخیره شد.</div>}
   </section>
   <p className="muted text-xs">پیش از خروج، «پایان و ذخیره نتیجه» را بزن تا امتیاز ثبت شود.</p>
  </>}
  <section className="card space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-bold">سوابق بازی</h2><span className="muted text-xs">۲۰ نتیجه آخر · همین دستگاه</span></div>{history.length===0?<p className="muted text-sm">هنوز نتیجه‌ای ثبت نشده است.</p>:<ol className="divide-y divide-slate-200 dark:divide-white/10">{history.map(x=><li key={x.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{new Date(x.date).toLocaleString("fa-IR")}</p><p className="muted mt-1">{fa(x.correct)} درست از {fa(x.answered)} · رکورد متوالی {fa(x.bestStreak)}</p></div><strong className="text-lg">{fa(x.points)} امتیاز</strong></li>)}</ol>}</section>
  <div className="flex gap-2"><button className="btn btn-ghost" onClick={restart}>شروع دوباره بازی</button></div>
 </div>;
}