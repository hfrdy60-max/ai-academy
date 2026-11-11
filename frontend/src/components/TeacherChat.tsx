import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";
import Icon from "./Icon";
import { errMsg } from "../lib/errors";
import { AiError, askTeacher } from "../services/aiClient";
import type { TeacherContext } from "../services/aiClient";
import { appendUser, clearThread, getReply, loadThread } from "../services/chatService";
import type { ChatThread } from "../types/chat";
import type { Level } from "../types/course";

const COURSE_DRAFT_KEY = "ai-academy-course-draft";

interface Props { threadKey: string; level: Level; context: TeacherContext; suggestions?: string[] }

const aiMsg = (e: unknown) => (e instanceof AiError ? e.message : errMsg(e));

/** Persistent conversation with the AI teacher. History is saved in IndexedDB per thread. */
export default function TeacherChat({ threadKey, level, context, suggestions = [] }: Props) {
  const navigate = useNavigate();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const active = useRef(threadKey);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    active.current = threadKey;
    setThread(null); setError(null); setBusy(false);
    loadThread(threadKey).then(t => { if (active.current === threadKey) setThread(t); }).catch(e => setError(errMsg(e)));
  }, [threadKey]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "nearest" }); }, [thread?.messages.length, busy]);

  const last = thread?.messages[thread.messages.length - 1];

  async function ask(raw: string) {
    const msg = raw.trim();
    if (!thread || busy || !msg) return;
    const key = threadKey;
    setBusy(true); setError(null); setText("");
    try {
      const t1 = await appendUser(thread, msg);
      if (active.current !== key) return;
      setThread(t1);
      try { const t2 = await getReply(t1, level, context); if (active.current === key) setThread(t2); }
      catch (e) { if (active.current === key) setError(aiMsg(e)); }
    } catch (e) { setError(errMsg(e)); setText(msg); }
    finally { if (active.current === key) setBusy(false); }
  }

  async function retry() {
    if (!thread || busy) return;
    const key = threadKey;
    setBusy(true); setError(null);
    try { const t = await getReply(thread, level, context); if (active.current === key) setThread(t); }
    catch (e) { if (active.current === key) setError(aiMsg(e)); }
    finally { if (active.current === key) setBusy(false); }
  }

  async function turnConversationIntoCourse() {
    if (!thread || busy || !thread.some) { /* guarded below */ }
    if (!thread || busy || !thread.messages.some(m => m.role === "user")) return;
    setBusy(true); setError(null);
    try {
      const instruction = `از درخواست‌های من در این گفتگو، مشخصات یک دوره آموزشی را استخراج کن. فقط یک شیء JSON معتبر و بدون markdown برگردان با این کلیدها: {"title":"عنوان کوتاه دوره","subject":"موضوع اصلی","level":"beginner|intermediate|advanced","goal":"هدف یادگیری روشن و قابل سنجش","description":"توضیح کامل محدوده موضوعات، پیش‌نیازها، سرفصل‌های مورد انتظار و مهارت‌های پایانی در حداکثر ۱۰۰۰ نویسه"}. سطح صریح من را حفظ کن؛ اگر نگفته‌ام از پیچیدگی درخواست استنباط کن. همه متن‌ها فارسی باشند.`;
      const history = thread.messages.slice(-16).map(m => ({ role: m.role, content: m.content }));
      const raw = await askTeacher(level, context, [...history, { role: "user", content: instruction }]);
      const match = raw.match(/\\{[\\s\\S]*\\}/);
      if (!match) throw new Error("مشخصات دوره استخراج نشد؛ درخواست ساخت دوره را واضح‌تر بیان کنید.");
      const draft = JSON.parse(match[0]) as Record<string, unknown>;
      const title = typeof draft.title === "string" ? draft.title.trim() : "";
      const subject = typeof draft.subject === "string" ? draft.subject.trim() : "";
      if (!title || !subject) throw new Error("عنوان یا موضوع دوره به‌درستی تشخیص داده نشد.");
      const pickedLevel: Level = draft.level === "advanced" || draft.level === "intermediate" ? draft.level : "beginner";
      sessionStorage.setItem(COURSE_DRAFT_KEY, JSON.stringify({
        title: title.slice(0, 100), subject: subject.slice(0, 100), level: pickedLevel,
        goal: typeof draft.goal === "string" ? draft.goal.slice(0, 500) : "",
        description: typeof draft.description === "string" ? draft.description.slice(0, 1000) : "",
        structure: "ai"
      }));
      navigate("/create");
    } catch (e) {
      setError(e instanceof AiError ? e.message : e instanceof Error ? e.message : "تبدیل گفتگو ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function doClear() {
    setConfirmClear(false);
    try { setThread(await clearThread(threadKey)); setError(null); } catch (e) { setError(errMsg(e)); }
  }

  return (
    <section className="card space-y-3" aria-label="گفتگو با معلم هوش مصنوعی">
      <div className="max-h-[28rem] min-h-24 space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label="پیام‌های گفتگو">
        {thread === null && <p className="muted text-sm" role="status">در حال بارگذاری گفتگو…</p>}
        {thread && thread.messages.length === 0 && <p className="muted text-sm">سؤال خود را بنویسید. معلم مرحله‌به‌مرحله و متناسب با سطح شما توضیح می‌دهد.</p>}
        {thread?.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-7 ${m.role === "user"
              ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-slate-100"}`}>
              <span className="sr-only">{m.role === "user" ? "شما: " : "معلم: "}</span>{m.content}
            </div>
          </div>
        ))}
        {busy && <p className="muted text-sm" role="status">معلم در حال نوشتن پاسخ است…</p>}
        <div ref={endRef} />
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
          <p>{error}</p>
          {last?.role === "user" && <button type="button" className="btn btn-ghost mt-2" onClick={() => void retry()} disabled={busy}><Icon name="refresh" className="h-4 w-4" />تلاش دوباره</button>}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button key={s} type="button" className="btn btn-ghost !min-h-9 !px-3 text-xs" disabled={busy || !thread} onClick={() => void ask(s)}>{s}</button>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); void ask(text); }} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`chat-in-${threadKey}`} className="sr-only">پیام شما</label>
          <textarea id={`chat-in-${threadKey}`} className="input" rows={2} maxLength={2000} value={text} placeholder="سؤال یا بخشی که متوجه نشدید را بنویسید…"
                    onChange={e => setText(e.target.value)} disabled={!thread} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !thread || !text.trim()} aria-label="ارسال پیام"><Icon name="send" className="h-4 w-4" />ارسال</button>
      </form>

      {thread && thread.messages.some(m => m.role === "user") && (
        <div className="rounded-xl border border-indigo-300/40 bg-indigo-500/5 p-3 space-y-2">
          <p className="text-sm leading-6">درخواست دوره‌ات را در گفتگو توضیح بده؛ معلم عنوان، موضوع، سطح، هدف و توضیحات را استخراج می‌کند و فرم ساخت دوره را پر می‌کند.</p>
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void turnConversationIntoCourse()}>
            تبدیل گفتگو به فرم ساخت دوره
          </button>
        </div>
      )}

      {thread && thread.messages.length > 0 && (
        <button type="button" className="muted text-xs underline" onClick={() => setConfirmClear(true)}>پاک کردن این گفتگو</button>
      )}
      <ConfirmDialog open={confirmClear} title="پاک کردن گفتگو" message="تمام پیام‌های این گفتگو از این دستگاه حذف می‌شود."
        confirmLabel="پاک کردن" onConfirm={() => void doClear()} onCancel={() => setConfirmClear(false)} />
    </section>
  );
}
