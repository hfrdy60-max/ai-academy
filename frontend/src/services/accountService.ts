import { getAiSettings, normalizeWorkerUrl } from "./settingsService";

const TOKEN_KEY = "ai-academy-session";
const USER_KEY = "ai-academy-user";
const DEFAULT_WORKER = "https://ai-academy-api.hfrdy60.workers.dev";

export interface AccountUser { id: string; email: string }
async function apiBase(): Promise<string> {
  const settings = await getAiSettings();
  const configured = import.meta.env?.VITE_WORKER_URL;
  return normalizeWorkerUrl(settings.workerUrl || (typeof configured === "string" && configured ? configured : DEFAULT_WORKER));
}
async function request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const base = await apiBase();
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(base + path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.auth && token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data: any = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok || !data?.ok) {
    const code = typeof data?.error === "string" ? data.error : "network";
    const messages: Record<string,string> = {
      database_not_configured: "پایگاه داده ابری هنوز راه‌اندازی نشده است.",
      email_not_configured: "ارسال ایمیل هنوز روی سرور تنظیم نشده است.",
      email_delivery_failed: "ارسال ایمیل ناموفق بود؛ تنظیمات فرستنده را بررسی کنید.",
      invalid_email: "نشانی ایمیل معتبر نیست.",
      invalid_code: "کد باید ۶ رقم باشد.",
      invalid_or_expired_code: "کد اشتباه است یا اعتبار آن تمام شده است.",
      session_expired: "نشست شما منقضی شده است؛ دوباره وارد شوید.",
      rate_limited: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
      unauthorized: "برای ادامه وارد حساب شوید.",
      invalid_pagination: "درخواست صفحه‌بندی همگام‌سازی معتبر نیست؛ صفحه را تازه‌سازی کنید.",
      invalid_course: "یکی از دوره‌های همگام‌سازی‌شده ساختار معتبری ندارد.",
      invalid_course_content: "محتوای یکی از درس‌ها ساختار معتبری ندارد.",
      invalid_chat: "یکی از گفتگوهای همگام‌سازی‌شده ساختار معتبری ندارد.",
      invalid_results: "سوابق آزمون یا بازی برای همگام‌سازی معتبر نیستند.",
      invalid_result: "یکی از سوابق آزمون یا بازی معتبر نیست.",
      invalid_profile: "اطلاعات پروفایل برای همگام‌سازی معتبر نیست."
    };
    throw new Error(messages[code] ?? "ارتباط با سرور برقرار نشد. تنظیمات و استقرار Worker را بررسی کنید.");
  }
  return data as T;
}
export async function requestLoginCode(email: string): Promise<void> {
  await request("/api/auth/register", { method: "POST", body: { email } });
}
export async function verifyLoginCode(email: string, code: string): Promise<AccountUser> {
  const result = await request<{ token: string; user: AccountUser }>("/api/auth/verify", { method: "POST", body: { email, code } });
  sessionStorage.setItem(TOKEN_KEY, result.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
  return result.user;
}
export function getSessionToken(): string | null { return sessionStorage.getItem(TOKEN_KEY); }
export function clearAccountSession(): void { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }
export function getCachedAccount(): AccountUser | null {
  try { const raw = sessionStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) as AccountUser : null; } catch { return null; }
}
export async function getCurrentAccount(): Promise<AccountUser> {
  const result = await request<{ user: AccountUser }>("/api/auth/me", { auth: true });
  sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
  return result.user;
}
export async function logoutAccount(): Promise<void> {
  try { if (getSessionToken()) await request("/api/auth/logout", { method: "POST", auth: true }); }
  finally { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }
}
export async function accountApi<T>(path: string, method: "GET" | "PUT", body?: unknown): Promise<T> {
  return request<T>(path, { method, body, auth: true });
}
