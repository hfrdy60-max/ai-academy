import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { requestLoginCode, verifyLoginCode } from "../services/accountService";
import { syncAccountData } from "../services/syncService";

export default function Account() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from || "/";

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await requestLoginCode(email);
      setStage("code");
      setMessage("اگر تنظیمات سرور کامل باشد، کد ۶ رقمی به ایمیل شما ارسال می‌شود. کد تا ۱۰ دقیقه اعتبار دارد.");
    } catch (err) { setError(err instanceof Error ? err.message : "ارسال کد ناموفق بود."); }
    finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await verifyLoginCode(email, code.trim());
      navigate(destination, { replace: true });
      void syncAccountData().catch(() => { /* the header exposes manual retry */ });
    } catch (err) { setError(err instanceof Error ? err.message : "تأیید کد ناموفق بود."); }
    finally { setBusy(false); }
  }
  return (
    <main dir="rtl" className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 dark:bg-[#0b1020]">
      <section className="card w-full max-w-md space-y-5 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white">✦</div>
          <h1 className="text-2xl font-extrabold">آکادمی هوش مصنوعی</h1>
          <p className="muted mt-2 text-sm">ورود یا ساخت حساب با ایمیل</p>
        </div>
        {stage === "email" ? (
          <form className="space-y-4" onSubmit={send}>
            <label className="block text-sm font-bold" htmlFor="account-email">نشانی ایمیل</label>
            <input id="account-email" className="input text-left" dir="ltr" type="email" autoComplete="email" required maxLength={254}
              value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "در حال ارسال…" : "ارسال کد تأیید"}</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={verify}>
            <p className="text-sm leading-7">کد ارسال‌شده به <b dir="ltr">{email}</b> را وارد کنید.</p>
            <label className="block text-sm font-bold" htmlFor="account-code">کد ۶ رقمی</label>
            <input id="account-code" className="input text-center text-xl tracking-[0.5em]" dir="ltr" inputMode="numeric"
              autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g,"").slice(0,6))} />
            <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "در حال بررسی…" : "تأیید و ورود"}</button>
            <button type="button" className="btn btn-ghost w-full" onClick={() => { setStage("email"); setCode(""); setMessage(""); setError(""); }}>تغییر ایمیل</button>
          </form>
        )}
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
        <p className="muted text-center text-xs leading-6">با تأیید ایمیل، حساب شما ساخته می‌شود یا وارد حساب قبلی خود می‌شوید. رمز عبور لازم نیست.</p>
      </section>
    </main>
  );
}
