import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import { errMsg } from "../lib/errors";
import { fa } from "../lib/format";
import { AiError, testConnection } from "../services/aiClient";
import { deleteAllData, exportData, importData, MAX_IMPORT_BYTES } from "../services/backupService";
import { getAiSettings, getProfile, getUsage, saveAiSettings, saveProfile } from "../services/settingsService";

type Msg = { ok: boolean; text: string } | null;
const Note = ({ m }: { m: Msg }) => m ? <p role={m.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${m.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"}`}>{m.text}</p> : null;

export default function Settings() {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("1");
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [url, setUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [aiMsg, setAiMsg] = useState<Msg>(null);
  const [testing, setTesting] = useState(false);
  const [usage, setUsage] = useState(0);
  const [dataMsg, setDataMsg] = useState<Msg>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [p, a, u] = await Promise.all([getProfile(), getAiSettings(), getUsage()]);
        setName(p.displayName); setGoal(String(p.dailyGoal)); setUrl(a.workerUrl); setAccessToken(a.accessToken); setUsage(u);
      } catch (e) { setDataMsg({ ok: false, text: errMsg(e) }); }
      finally { setReady(true); }
    })();
  }, []);
  useEffect(() => {
    const refreshProfile = () => {
      void getProfile().then(p => { setName(p.displayName); setGoal(String(p.dailyGoal)); }).catch(() => {});
    };
    window.addEventListener("ai-academy-profile-change", refreshProfile);
    return () => window.removeEventListener("ai-academy-profile-change", refreshProfile);
  }, []);

  async function onSaveProfile(e: { preventDefault: () => void }) {
    e.preventDefault();
    try { const p = await saveProfile({ displayName: name, dailyGoal: Number(goal) }); setName(p.displayName); setGoal(String(p.dailyGoal)); setProfileMsg({ ok: true, text: "پروفایل ذخیره شد." }); }
    catch (err) { setProfileMsg({ ok: false, text: errMsg(err) }); }
  }

  async function onSaveAi(e: { preventDefault: () => void }) {
    e.preventDefault();
    try { const s = await saveAiSettings({ workerUrl: url, accessToken }); setUrl(s.workerUrl); setAccessToken(s.accessToken); setAiMsg({ ok: true, text: "تنظیمات اتصال ذخیره شد." }); }
    catch (err) { setAiMsg({ ok: false, text: errMsg(err) }); }
  }

  async function onTest() {
    setTesting(true); setAiMsg(null);
    try {
      const r = await testConnection(url);
      setAiMsg(r.aiConfigured ? { ok: true, text: "اتصال برقرار است و کلید هوش مصنوعی روی سرور تنظیم شده است." }
        : { ok: false, text: "اتصال حساب برقرار است، اما کلید OpenRouter هنوز روی سرور (Worker) تنظیم نشده است." });
    } catch (err) { setAiMsg({ ok: false, text: err instanceof AiError ? err.message : errMsg(err) }); }
    finally { setTesting(false); }
  }

  async function onExport() {
    try {
      const blob = new Blob([await exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ai-academy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setDataMsg({ ok: true, text: "فایل پشتیبان ساخته شد. اطلاعات نشست در آن قرار نمی‌گیرد." });
    } catch (err) { setDataMsg({ ok: false, text: errMsg(err) }); }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { setDataMsg({ ok: false, text: "فایل بیش از حد بزرگ است." }); return; }
    try {
      const r = await importData(await file.text());
      setDataMsg({ ok: true, text: `${fa(r.courses)} دوره، ${fa(r.chats)} گفتگو، ${fa(r.exams)} سابقه آزمون و ${fa(r.games)} سابقه بازی وارد شد.` });
    } catch (err) { setDataMsg({ ok: false, text: errMsg(err) }); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  async function onWipe() {
    setConfirmWipe(false);
    try { await deleteAllData(); setName(""); setGoal("1"); setUrl(""); setAccessToken(""); setUsage(0); setDataMsg({ ok: true, text: "همه داده‌های این برنامه از این دستگاه پاک شد." }); }
    catch (err) { setDataMsg({ ok: false, text: errMsg(err) }); }
  }

  if (!ready) return <p className="muted" role="status">در حال بارگذاری…</p>;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold md:text-2xl">تنظیمات</h1>

      <form onSubmit={e => void onSaveProfile(e)} className="card space-y-4" aria-labelledby="s-profile">
        <h2 id="s-profile" className="font-bold">پروفایل</h2>
        <p className="muted text-sm leading-7">پروفایل نمایشی و هدف روزانه روی دستگاه ذخیره می‌شوند و پس از ورود به حساب بین دستگاه‌ها همگام‌سازی خواهند شد.</p>
        <div><label htmlFor="p-name" className="mb-1 block text-sm font-bold">نام نمایشی</label><input id="p-name" className="input" maxLength={40} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label htmlFor="p-goal" className="mb-1 block text-sm font-bold">هدف روزانه (تعداد درس در روز)</label>
          <select id="p-goal" className="input" value={goal} onChange={e => setGoal(e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{fa(n)} درس</option>)}</select></div>
        <Note m={profileMsg} />
        <button type="submit" className="btn btn-primary">ذخیره پروفایل</button>
      </form>

      <form onSubmit={e => void onSaveAi(e)} className="card space-y-4" aria-labelledby="s-ai">
        <h2 id="s-ai" className="font-bold">اتصال هوش مصنوعی</h2>
        <p className="muted text-sm leading-7">درخواست‌های هوش مصنوعی با نشست امن حساب کاربری شما احراز هویت می‌شوند. کلید OpenRouter فقط روی سرور (Worker) نگهداری می‌شود و هرگز به مرورگر نمی‌آید.</p>
        <div><label htmlFor="a-url" className="mb-1 block text-sm font-bold">آدرس Worker</label>
          <input id="a-url" className="input text-left" dir="ltr" inputMode="url" autoComplete="off" placeholder="https://ai-academy-api.xxx.workers.dev" value={url} onChange={e => setUrl(e.target.value)} /></div>
        <div><label htmlFor="a-token" className="mb-1 block text-sm font-bold">رمز دسترسی Worker</label><div className="flex gap-2"><input id="a-token" className="input min-w-0 flex-1 text-left" dir="ltr" autoComplete="off" type={showToken ? "text" : "password"} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="رمز دسترسی تنظیم‌شده روی Worker" /><button type="button" className="btn btn-ghost shrink-0" onClick={() => setShowToken(v => !v)} aria-label={showToken ? "پنهان کردن رمز" : "نمایش رمز"}>{showToken ? "پنهان" : "نمایش"}</button></div><p className="muted mt-1 text-xs">این رمز در حافظه امن محلی همین دستگاه نگهداری می‌شود. اگر از ورود حساب استفاده می‌کنید، این قسمت لازم نیست.</p></div>
        <Note m={aiMsg} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">ذخیره</button>
          <button type="button" className="btn btn-ghost" disabled={testing} onClick={() => void onTest()}>{testing ? "در حال تست…" : "تست اتصال"}</button>
        </div>
        <p className="muted text-xs">مجموع توکن‌های مصرف‌شده در این دستگاه (طبق گزارش سرویس): {fa(usage)}</p>
      </form>

      <section className="card space-y-3" aria-labelledby="s-data">
        <h2 id="s-data" className="font-bold">داده‌های من</h2>
        <p className="muted text-sm leading-7">دوره‌ها، گفتگوها، سوابق آزمون و بازی و پروفایل روی این دستگاه نگهداری می‌شوند. پس از ورود به حساب و راه‌اندازی بک‌اند، این اطلاعات با همگام‌سازی به فضای ابری منتقل می‌شوند. دکمه پاک‌کردن، فقط اطلاعات همین دستگاه را حذف می‌کند و داده‌های ابری حساب را پاک نمی‌کند؛ در همگام‌سازی بعدی، اطلاعات ابری دوباره روی دستگاه دریافت می‌شوند. برای جلوگیری از از دست رفتن اطلاعات، پیش از این کار فایل پشتیبان بگیرید.</p>
        <Note m={dataMsg} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => void onExport()}><Icon name="download" className="h-4 w-4" />دریافت فایل پشتیبان</button>
          <label className="btn btn-ghost cursor-pointer"><Icon name="upload" className="h-4 w-4" />وارد کردن فایل پشتیبان
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={e => void onImport(e.target.files?.[0])} /></label>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmWipe(true)}><Icon name="trash" className="h-4 w-4" />پاک کردن داده‌های این دستگاه</button>
        </div>
      </section>

      <ConfirmDialog open={confirmWipe} title="پاک کردن داده‌های این دستگاه" message="این کار فقط دوره‌ها، پیشرفت، گفتگوها، پروفایل، سوابق و تنظیمات محلی را از همین دستگاه حذف می‌کند. داده‌های حساب ابری حذف نمی‌شوند و در همگام‌سازی بعدی دوباره دریافت خواهند شد. این کار محلی قابل بازگشت نیست؛ ابتدا فایل پشتیبان بگیرید."
        confirmLabel="پاک کردن داده‌های محلی" onConfirm={() => void onWipe()} onCancel={() => setConfirmWipe(false)} />
    </div>
  );
}
