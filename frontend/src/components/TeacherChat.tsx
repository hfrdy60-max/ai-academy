import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import Icon from "./Icon";
import { errMsg } from "../lib/errors";
import { AiError } from "../services/aiClient";
import type { TeacherContext } from "../services/aiClient";
import { appendUser, clearThread, getReply, loadThread } from "../services/chatService";
import type { ChatThread } from "../types/chat";
import type { Level } from "../types/course";

interface Props { threadKey: string; level: Level; context: TeacherContext; suggestions?: string[] }

const aiMsg = (e: unknown) => (e instanceof AiError ? e.message : errMsg(e));

/** Persistent conversation with the AI teacher. History is saved in IndexedDB per thread. */
export default function TeacherChat({ threadKey, level, context, suggestions = [] }: Props) {
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

      {thread && thread.messages.length > 0 && (
        <button type="button" className="muted text-xs underline" onClick={() => setConfirmClear(true)}>پاک کردن این گفتگو</button>
      )}
      <ConfirmDialog open={confirmClear} title="پاک کردن گفتگو" message="تمام پیام‌های این گفتگو از این دستگاه حذف می‌شود."
        confirmLabel="پاک کردن" onConfirm={() => void doClear()} onCancel={() => setConfirmClear(false)} />
    </section>
  );
}
