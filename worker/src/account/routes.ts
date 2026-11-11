import type { Env } from "../types";
import { HttpError } from "../security/errors";
import { allowRequest } from "../security/rateLimit";
import { readJsonBody, obj, str } from "../security/validate";
import { normalizeEmail } from "./crypto";
import { findUserByEmail, insertUser, saveEmailVerification, consumeEmailVerification, putUserCourse, listUserCourses, putUserChat, listUserChats } from "./repository";
import { issueSession, resolveSession, revokeSessionToken } from "./session";

const MAX_BODY = 300 * 1024;
const CODE_TTL = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function bearer(req: Request): string {
  const value = req.headers.get("Authorization") ?? "";
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(value);
  if (!match) throw new HttpError(401, "unauthorized");
  return match[1];
}
async function currentUser(req: Request, env: Env) {
  if (!env.DB) throw new HttpError(503, "database_not_configured");
  const session = await resolveSession(env.DB, bearer(req));
  if (!session) throw new HttpError(401, "session_expired");
  return session;
}
function randomCode(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}
async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
async function sendCode(env: Env, email: string, code: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.AUTH_PEPPER) throw new HttpError(503, "email_not_configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "کد ورود به آکادمی هوش مصنوعی",
      text: `کد تأیید شما: ${code}\nاین کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ورود به آکادمی هوش مصنوعی</h2><p>کد تأیید شما:</p><strong style="font-size:28px;letter-spacing:6px">${code}</strong><p>این کد تا ۱۰ دقیقه معتبر است.</p><p>اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.</p></div>`
    })
  });
  if (!response.ok) throw new HttpError(502, "email_delivery_failed");
}
function clientIp(req: Request): string { return req.headers.get("CF-Connecting-IP") ?? "unknown"; }

export async function handleAccountRoute(request: Request, env: Env, path: string): Promise<Response | null> {
  const method = request.method;
  if (!path.startsWith("/api/auth/") && !path.startsWith("/api/sync/")) return null;
  if (!env.DB) throw new HttpError(503, "database_not_configured");

  const limit = Number(env.AUTH_RATE_LIMIT_PER_MINUTE) || 12;
  const ip = clientIp(request);
  if (!allowRequest(`auth:${ip}`, limit)) throw new HttpError(429, "rate_limited");

  if (path === "/api/auth/register" && method === "POST") {
    const body = obj(await readJsonBody(request, 4096), "body");
    let email: string;
    try { email = normalizeEmail(str(body.email, "email", 254)); }
    catch { throw new HttpError(400, "invalid_email"); }
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "invalid_email");
    if (!allowRequest(`register:${email}`, 3)) throw new HttpError(429, "rate_limited");
    if (!env.AUTH_PEPPER) throw new HttpError(503, "email_not_configured");
    const code = randomCode();
    const codeHash = await digest(`${email}:${code}:${env.AUTH_PEPPER}`);
    await saveEmailVerification(env.DB, email, codeHash, Date.now(), Date.now() + CODE_TTL);
    await sendCode(env, email, code);
    return json({ ok: true, message: "اگر امکان ارسال به این نشانی وجود داشته باشد، کد تأیید ارسال شده است.", expiresInSeconds: 600 });
  }

  if (path === "/api/auth/verify" && method === "POST") {
    const body = obj(await readJsonBody(request, 4096), "body");
    let email: string;
    try { email = normalizeEmail(str(body.email, "email", 254)); }
    catch { throw new HttpError(400, "invalid_email"); }
    const code = str(body.code, "code", 6);
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, "invalid_code");
    if (!allowRequest(`verify:${email}`, 10)) throw new HttpError(429, "rate_limited");
    if (!env.AUTH_PEPPER) throw new HttpError(503, "email_not_configured");
    const codeHash = await digest(`${email}:${code}:${env.AUTH_PEPPER}`);
    const valid = await consumeEmailVerification(env.DB, email, codeHash, Date.now());
    if (!valid) throw new HttpError(401, "invalid_or_expired_code");
    let user = await findUserByEmail(env.DB, email);
    if (!user) {
      const now = Date.now();
      const id = crypto.randomUUID();
      try { await insertUser(env.DB, id, email, now); }
      catch { user = await findUserByEmail(env.DB, email); }
      if (!user) user = await findUserByEmail(env.DB, email);
    }
    if (!user) throw new HttpError(500, "account_creation_failed");
    const session = await issueSession(env.DB, user.id);
    return json({ ok: true, token: session.token, expiresAt: session.expiresAt, user: { id: user.id, email: user.email } });
  }

  if (path === "/api/auth/me" && method === "GET") {
    const user = await currentUser(request, env);
    return json({ ok: true, user: { id: user.userId, email: user.email }, expiresAt: user.expiresAt });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = bearer(request);
    await revokeSessionToken(env.DB, token);
    return json({ ok: true });
  }

  if (path === "/api/sync/courses" && method === "GET") {
    const user = await currentUser(request, env);
    return json({ ok: true, records: await listUserCourses(env.DB, user.userId, 200) });
  }
  if (path === "/api/sync/courses" && method === "PUT") {
    const user = await currentUser(request, env);
    const body = obj(await readJsonBody(request, MAX_BODY), "body");
    if (!Array.isArray(body.records) || body.records.length > 200) throw new HttpError(400, "invalid_records");
    const now = Date.now();
    for (const record of body.records) {
      const item = obj(record, "record");
      const id = str(item.id, "record_id", 128);
      await putUserCourse(env.DB, user.userId, id, item.payload, now);
    }
    return json({ ok: true, saved: body.records.length });
  }
  if (path === "/api/sync/chats" && method === "GET") {
    const user = await currentUser(request, env);
    return json({ ok: true, records: await listUserChats(env.DB, user.userId, 200) });
  }
  if (path === "/api/sync/chats" && method === "PUT") {
    const user = await currentUser(request, env);
    const body = obj(await readJsonBody(request, MAX_BODY), "body");
    if (!Array.isArray(body.records) || body.records.length > 200) throw new HttpError(400, "invalid_records");
    const now = Date.now();
    for (const record of body.records) {
      const item = obj(record, "record");
      const id = str(item.id, "record_id", 128);
      await putUserChat(env.DB, user.userId, id, item.payload, now);
    }
    return json({ ok: true, saved: body.records.length });
  }
  throw new HttpError(404, "not_found");
}
