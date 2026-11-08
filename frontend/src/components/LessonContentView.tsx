import { useState } from "react";
import Icon from "./Icon";
import { errMsg } from "../lib/errors";
import { fa } from "../lib/format";
import { AiError, checkAnswer } from "../services/aiClient";
import type { Exercise, LessonContent, Level, QuizItem } from "../types/course";

// All lesson text is rendered as plain text by React (never as HTML), so AI output cannot inject markup.
function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).filter(p => p.trim()).map((p, i) => <p key={i} className="whitespace-pre-line leading-8">{p}</p>)}</>;
}

const VERDICT = {
  correct: { label: "درست", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200" },
  partial: { label: "تا حدی درست", cls: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200" },
  incorrect: { label: "نادرست", cls: "bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-200" }
} as const;

function ExerciseItem({ ex, index, lessonTitle, level }: { ex: Exercise; index: number; lessonTitle: string; level: Level }) {
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ verdict: keyof typeof VERDICT; feedback: string } | null>(null);

  async function check() {
    setBusy(true); setError(null);
    try {
      const r = await checkAnswer({ lessonTitle, level, question: ex.question, learnerAnswer: answer.trim(), sampleAnswer: ex.sampleAnswer });
      setResult(r.data);
    } catch (e) { setError(e instanceof AiError ? e.message : errMsg(e)); }
    finally { setBusy(false); }
  }

  return (
    <li className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <p className="muted text-xs font-bold">تمرین {fa(index + 1)}</p>
      <p className="font-bold leading-7">{ex.question}</p>
      <label htmlFor={`ex-${index}`} className="sr-only">پاسخ شما به تمرین {fa(index + 1)}</label>
      <textarea id={`ex-${index}`} className="input" rows={3} maxLength={3000} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="پاسخ خود را بنویسید…" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !answer.trim()} onClick={() => void check()}>{busy ? "در حال بررسی…" : "بررسی پاسخ با هوش مصنوعی"}</button>
        {ex.hint && <button type="button" className="btn btn-ghost" aria-expanded={hint} onClick={() => setHint(h => !h)}>راهنمایی</button>}
        {ex.sampleAnswer && <button type="button" className="btn btn-ghost" aria-expanded={sample} onClick={() => setSample(s => !s)}>پاسخ نمونه</button>}
      </div>
      {hint && <p className="rounded-lg bg-slate-100 p-2 text-sm leading-7 dark:bg-white/10">{ex.hint}</p>}
      {sample && <p className="whitespace-pre-line rounded-lg bg-slate-100 p-2 text-sm leading-7 dark:bg-white/10">{ex.sampleAnswer}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {result && (
        <div role="status" className="space-y-1 text-sm">
          <span className={`badge ${VERDICT[result.verdict].cls}`}>{VERDICT[result.verdict].label}</span>
          <p className="whitespace-pre-line leading-7">{result.feedback}</p>
        </div>
      )}
    </li>
  );
}

function QuizQuestion({ q, index, onResult }: { q: QuizItem; index: number; onResult: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  return (
    <li>
      <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <legend className="px-1 font-bold leading-7"><span className="muted block text-xs">سؤال {fa(index + 1)}</span>{q.question}</legend>
        {q.options.map((o, i) => {
          const isRight = checked && i === q.correctIndex;
          const isWrong = checked && picked === i && i !== q.correctIndex;
          return (
            <label key={i} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${isRight ? "border-emerald-500" : isWrong ? "border-red-500" : "border-slate-200 dark:border-white/10"}`}>
              <input type="radio" name={`quiz-${index}`} className="h-4 w-4" checked={picked === i} disabled={checked} onChange={() => setPicked(i)} />
              <span className="flex-1">{o}</span>
              {isRight && <span className="font-bold text-emerald-700 dark:text-emerald-300">پاسخ درست</span>}
              {isWrong && <span className="font-bold text-red-700 dark:text-red-300">پاسخ شما</span>}
            </label>
          );
        })}
        {!checked && <button type="button" className="btn btn-primary" disabled={picked === null} onClick={() => { setChecked(true); onResult(picked === q.correctIndex); }}>بررسی پاسخ</button>}
        {checked && (
          <p role="status" className="text-sm leading-7">
            <strong>{picked === q.correctIndex ? "آفرین، درست بود. " : "پاسخ درست گزینه دیگری بود. "}</strong>{q.explanation}
          </p>
        )}
      </fieldset>
    </li>
  );
}

export default function LessonContentView({ content, lessonTitle, level }: { content: LessonContent; lessonTitle: string; level: Level }) {
  const [results, setResults] = useState<Record<number, boolean>>({});
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;
  const H = ({ children }: { children: string }) => <h2 className="mb-2 text-lg font-extrabold">{children}</h2>;

  return (
    <div className="space-y-6">
      {content.intro && <section><H>مقدمه</H><Paragraphs text={content.intro} /></section>}
      {content.objectives.length > 0 && (
        <section><H>اهداف آموزشی</H><ul className="list-disc space-y-1 ps-6 leading-8">{content.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
      )}
      <section><H>آموزش</H><div className="space-y-3"><Paragraphs text={content.explanation} /></div></section>
      {content.examples.length > 0 && (
        <section><H>مثال‌های کاربردی</H><ol className="space-y-3">{content.examples.map((e, i) => <li key={i} className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-400/10"><Paragraphs text={e} /></li>)}</ol></section>
      )}
      {content.notes.length > 0 && (
        <section><H>نکات مهم</H><ul className="space-y-2">{content.notes.map((n, i) => <li key={i} className="rounded-xl border-s-4 border-amber-500 bg-amber-50 p-3 leading-7 dark:bg-amber-400/10">{n}</li>)}</ul></section>
      )}
      {content.exercises.length > 0 && (
        <section><H>تمرین‌ها</H><ol className="space-y-3">{content.exercises.map((ex, i) => <ExerciseItem key={i} ex={ex} index={i} lessonTitle={lessonTitle} level={level} />)}</ol></section>
      )}
      {content.quiz.length > 0 && (
        <section>
          <H>سؤالات ارزیابی</H>
          <ol className="space-y-3">{content.quiz.map((q, i) => <QuizQuestion key={i} q={q} index={i} onResult={ok => setResults(r => ({ ...r, [i]: ok }))} />)}</ol>
          {answered === content.quiz.length && <p role="status" className="mt-3 font-bold">نتیجه: {fa(correct)} از {fa(content.quiz.length)} پاسخ درست</p>}
        </section>
      )}
      {content.summary && <section><H>جمع‌بندی</H><Paragraphs text={content.summary} /></section>}
      <p className="muted flex items-center gap-1 text-xs"><Icon name="check" className="h-3 w-3" />نتیجه تمرین‌ها و آزمون فقط روی همین صفحه نشان داده می‌شود و ذخیره نمی‌شود.</p>
    </div>
  );
}
