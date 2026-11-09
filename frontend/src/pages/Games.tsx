import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCourseList } from "../hooks/useCourses";
import { fa } from "../lib/format";
import type { QuizItem } from "../types/course";
type Card={courseTitle:string;lessonTitle:string;q:QuizItem};
export default function Games(){
 const {courses,error}=useCourseList();
 const deck=useMemo<Card[]>(()=> (courses??[]).flatMap(c=>c.chapters.flatMap(ch=>ch.lessons.flatMap(l=>(l.content?.quiz??[]).map(q=>({courseTitle:c.title,lessonTitle:l.title,q}))))),[courses]);
 const [order,setOrder]=useState(0); const [picked,setPicked]=useState<number|null>(null); const [points,setPoints]=useState(0); const [streak,setStreak]=useState(0); const [answered,setAnswered]=useState(false);
 const current=deck.length?deck[order%deck.length]:null;
 function answer(i:number){if(answered||!current)return;setPicked(i);setAnswered(true);if(i===current.q.correctIndex){setPoints(p=>p+10);setStreak(s=>s+1);}else setStreak(0);}
 function next(){setOrder(o=>o+1);setPicked(null);setAnswered(false);}
 if(courses===null)return <p className="muted" role="status">در حال آماده‌سازی بازی…</p>;
 return <div className="mx-auto max-w-2xl space-y-5">
  <header><h1 className="text-xl font-extrabold md:text-2xl">بازی‌های آموزشی</h1><p className="muted mt-1 text-sm">در چالش دانشی شرکت کن، امتیاز بگیر و زنجیره پاسخ‌های درست بساز.</p></header>
  {error&&<p role="alert" className="card text-sm text-red-700">{error}</p>}
  {!current?<section className="card space-y-3"><p className="font-bold">برای شروع بازی هنوز سؤالی نداریم.</p><p className="muted text-sm">برای درس‌های دوره‌ها محتوا و آزمون تولید کن تا کارت‌های بازی ساخته شوند.</p><Link className="btn btn-primary" to="/create">ساخت دوره</Link></section>:
  <>
   <div className="grid grid-cols-3 gap-3"><section className="card"><p className="muted text-xs">امتیاز</p><p className="text-2xl font-extrabold">{fa(points)}</p></section><section className="card"><p className="muted text-xs">پشت‌سرهم</p><p className="text-2xl font-extrabold">{fa(streak)}</p></section><section className="card"><p className="muted text-xs">سؤال</p><p className="text-2xl font-extrabold">{fa(order+1)}</p></section></div>
   <section className="card space-y-4"><div><p className="muted text-xs">{current.courseTitle} · {current.lessonTitle}</p><h2 className="text-lg font-bold leading-8">{current.q.question}</h2></div>
    <div className="grid gap-2">{current.q.options.map((o,i)=><button key={i} disabled={answered} onClick={()=>answer(i)} className={`min-h-12 rounded-xl border p-3 text-right text-sm ${answered&&i===current.q.correctIndex?"border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10":answered&&picked===i?"border-red-500":"border-slate-200 dark:border-white/10"}`}>{o}</button>)}</div>
    {answered&&<div className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm leading-7 dark:bg-white/10"><p className="font-bold">{picked===current.q.correctIndex?"آفرین! ۱۰ امتیاز گرفتی.":"این بار درست نبود؛ دفعه بعد تلاش کن."}</p><p>{current.q.explanation}</p><button className="btn btn-primary mt-2" onClick={next}>سؤال بعدی</button></div>}
   </section>
   <p className="muted text-xs">امتیاز بازی موقت است و با بستن صفحه از نو شروع می‌شود.</p>
  </>}
 </div>;
}