import { useState } from "react";
import Icon from "./Icon";
import { validateContent } from "../services/validate";
import { fa } from "../lib/format";
import type { LessonContent } from "../types/course";

interface QuizDraft { question: string; options: string[]; correctIndex: number; explanation: string }
interface ExDraft { question: string; hint: string; sampleAnswer: string }

const lines = (t: string) => t.split("\n").map(x => x.trim()).filter(Boolean);
const blocks = (t: string) => t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);

interface Props { initial: LessonContent | null; saving: boolean; error: string | null; onSave: (c: LessonContent) => void; onCancel: () => void }

/** Edit every part of a lesson. Validation is shared with the importer (services/validate.ts). */
export default function LessonEditor({ initial, saving, error, onSave, onCancel }: Props) {
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [objectives, setObjectives] = useState((initial?.objectives ?? []).join("\n"));
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [examples, setExamples] = useState((initial?.examples ?? []).join("\n\n"));
  const [notes, setNotes] = useState((initial?.notes ?? []).join("\n"));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [exercises, setExercises] = useState<ExDraft[]>(initial?.exercises ?? []);
  const [quiz, setQuiz] = useState<QuizDraft[]>(initial?.quiz ?? []);
  const [localError, setLocalError] = useState<string | null>(null);

  const setEx = (i: number, p: Partial<ExDraft>) => setExercises(l => l.map((x, k) => k === i ? { ...x, ...p } : x));
  const setQ = (i: number, p: Partial<QuizDraft>) => setQuiz(l => l.map((x, k) => k === i ? { ...x, ...p } : x));
  const setOpt = (i: number, j: number, v: string) => setQuiz(l => l.map((x, k) => k === i ? { ...x, options: x.options.map((o, m) => m === j ? v : o) } : x));
  const removeOpt = (i: number, j: number) => setQuiz(l => l.map((x, k) => k !== i ? x : {
    ...x, options: x.options.filter((_, m) => m !== j),
    correctIndex: x.correctIndex === j ? 0 : x.correctIndex > j ? x.correctIndex - 1 : x.correctIndex
  }));

  function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    try {
      const content = validateContent({
        intro, objectives: lines(objectives), explanation, examples: blocks(examples), notes: lines(notes), summary,
        exercises: exercises.filter(x => x.question.trim()),
        quiz: quiz.filter(q => q.question.trim() || q.options.some(o => o.trim()))
      });
      setLocalError(null);
      onSave(content);
    } catch (err) { setLocalError(err instanceof Error ? err.message : "محتوا معتبر نیست."); }
  }

  const L = ({ id, children }: { id: string; children: string }) => <label htmlFor={id} className="mb-1 block text-sm font-bold">{children}</label>;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><L id="e-intro">مقدمه</L><textarea id="e-intro" className="input" rows={3} value={intro} onChange={e => setIntro(e.target.value)} /></div>
      <div><L id="e-obj">اهداف آموزشی (هر خط یک هدف)</L><textarea id="e-obj" className="input" rows={4} value={objectives} onChange={e => setObjectives(e.target.value)} /></div>
      <div><L id="e-exp">آموزش (پاراگراف‌ها را با یک خط خالی جدا کنید) *</L><textarea id="e-exp" className="input" rows={10} value={explanation} onChange={e => setExplanation(e.target.value)} /></div>
      <div><L id="e-ex">مثال‌های کاربردی (هر مثال را با یک خط خالی جدا کنید)</L><textarea id="e-ex" className="input" rows={5} value={examples} onChange={e => setExamples(e.target.value)} /></div>
      <div><L id="e-notes">نکات مهم (هر خط یک نکته)</L><textarea id="e-notes" className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></div>

      <fieldset className="space-y-3"><legend className="mb-1 text-sm font-bold">تمرین‌ها</legend>
        {exercises.map((x, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <input className="input" aria-label={`صورت تمرین ${fa(i + 1)}`} placeholder="صورت تمرین" value={x.question} onChange={e => setEx(i, { question: e.target.value })} />
            <input className="input" aria-label={`راهنمای تمرین ${fa(i + 1)}`} placeholder="راهنمایی (اختیاری)" value={x.hint} onChange={e => setEx(i, { hint: e.target.value })} />
            <textarea className="input" rows={2} aria-label={`پاسخ نمونه تمرین ${fa(i + 1)}`} placeholder="پاسخ نمونه (اختیاری)" value={x.sampleAnswer} onChange={e => setEx(i, { sampleAnswer: e.target.value })} />
            <button type="button" className="btn btn-ghost" onClick={() => setExercises(l => l.filter((_, k) => k !== i))}><Icon name="trash" className="h-4 w-4" />حذف تمرین</button>
          </div>
        ))}
        {exercises.length < 10 && <button type="button" className="btn btn-ghost" onClick={() => setExercises(l => [...l, { question: "", hint: "", sampleAnswer: "" }])}><Icon name="plus" className="h-4 w-4" />افزودن تمرین</button>}
      </fieldset>

      <fieldset className="space-y-3"><legend className="mb-1 text-sm font-bold">سؤالات ارزیابی (چندگزینه‌ای)</legend>
        {quiz.map((q, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <input className="input" aria-label={`متن سؤال ${fa(i + 1)}`} placeholder="متن سؤال" value={q.question} onChange={e => setQ(i, { question: e.target.value })} />
            {q.options.map((o, j) => (
              <div key={j} className="flex items-center gap-2">
                <input type="radio" className="h-5 w-5" name={`correct-${i}`} checked={q.correctIndex === j} onChange={() => setQ(i, { correctIndex: j })} aria-label={`گزینه ${fa(j + 1)} پاسخ درست سؤال ${fa(i + 1)} است`} />
                <input className="input" aria-label={`گزینه ${fa(j + 1)} سؤال ${fa(i + 1)}`} value={o} onChange={e => setOpt(i, j, e.target.value)} />
                {q.options.length > 2 && <button type="button" className="btn btn-ghost !px-3" aria-label={`حذف گزینه ${fa(j + 1)}`} onClick={() => removeOpt(i, j)}><Icon name="trash" className="h-4 w-4" /></button>}
              </div>
            ))}
            {q.options.length < 6 && <button type="button" className="btn btn-ghost" onClick={() => setQ(i, { options: [...q.options, ""] })}>افزودن گزینه</button>}
            <input className="input" aria-label={`توضیح پاسخ سؤال ${fa(i + 1)}`} placeholder="توضیح پاسخ درست (اختیاری)" value={q.explanation} onChange={e => setQ(i, { explanation: e.target.value })} />
            <button type="button" className="btn btn-ghost" onClick={() => setQuiz(l => l.filter((_, k) => k !== i))}><Icon name="trash" className="h-4 w-4" />حذف سؤال</button>
          </div>
        ))}
        {quiz.length < 12 && <button type="button" className="btn btn-ghost" onClick={() => setQuiz(l => [...l, { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }])}><Icon name="plus" className="h-4 w-4" />افزودن سؤال</button>}
      </fieldset>

      <div><L id="e-sum">جمع‌بندی</L><textarea id="e-sum" className="input" rows={3} value={summary} onChange={e => setSummary(e.target.value)} /></div>

      {(localError || error) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{localError ?? error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>انصراف</button>
      </div>
    </form>
  );
}
