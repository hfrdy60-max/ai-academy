// The browser talks ONLY to our Worker. No AI key exists in the frontend.
import type { ChatMessage } from "../types/chat";
import type { Level, LessonContent } from "../types/course";
import { addUsage, getAiSettings, normalizeWorkerUrl } from "./settingsService";

export class AiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const MESSAGES: Record<string, string> = {
  not_configured_client: "اتصال هوش مصنوعی هنوز تنظیم نشده است. در بخش «تنظیمات» آدرس سرور و توکن دسترسی را وارد کنید.",
  offline: "اینترنت ندارید. قابلیت‌های هوش مصنوعی به اینترنت نیاز دارند؛ دوره‌های ذخیره‌شده آفلاین کار می‌کنند.",
  network: "ارتباط با سرور برقرار نشد. آدرس سرور و اینترنت را بررسی کنید.",
  timeout: "پاسخ سرور خیلی طول کشید. دوباره تلاش کنید.",
  unauthorized: "توکن دسترسی اشتباه است. آن را در «تنظیمات» بررسی کنید.",
  not_configured: "روی سرور (Worker) مقدار ACCESS_TOKEN تنظیم نشده است.",
  ai_not_configured: "کلید OpenRouter روی سرور (Worker) تنظیم نشده است.",
  ai_auth_failed: "کلید OpenRouter روی سرور نامعتبر است. تنظیمات Worker را بررسی کنید.",
  rate_limited: "درخواست‌ها زیاد بود. یک دقیقه صبر کنید و دوباره تلاش کنید.",
  ai_rate_limited: "سرویس هوش مصنوعی فعلاً شلوغ است. کمی بعد دوباره تلاش کنید.",
  ai_timeout: "هوش مصنوعی به‌موقع پاسخ نداد. دوباره تلاش کنید.",
  ai_unavailable: "سرویس هوش مصنوعی در دسترس نیست. کمی بعد دوباره تلاش کنید.",
  ai_bad_output: "پاسخ هوش مصنوعی قابل استفاده نبود. دوباره تلاش کنید.",
  ai_outline_incomplete: "ساختار دوره کامل و مطابق تعداد درس‌های این سطح نبود؛ لطفاً دوباره تلاش کنید.",
  ai_content_too_short: "محتوای تولیدشده به حداقل کیفیت این سطح نرسید؛ برای جلوگیری از نمایش درس ناقص، دوباره تولید کنید.",
  ai_output_truncated: "پاسخ هوش مصنوعی پیش از کامل شدن قطع شد؛ دوباره تلاش کنید.",
  invalid_progression: "اطلاعات ترتیب درس‌ها معتبر نیست؛ صفحه را تازه‌سازی کنید.",
  ai_empty_response: "هوش مصنوعی پاسخی نداد. دوباره تلاش کنید.",
  payload_too_large: "متن ارسالی بیش از حد طولانی است.",
  bad_server_config: "تنظیمات سرور (Worker) نادرست است.",
  not_found: "این آدرس روی سرور وجود ندارد. آدرس Worker را بررسی کنید."
};
export const aiErrorText = (code: string): string =>
  MESSAGES[code] ?? (code.startsWith("invalid_") || code.startsWith("too_long_") ? "اطلاعات ارسالی معتبر نیست؛ طول یا قالب متن‌ها را بررسی کنید." : "خطای ناشناخته از سرور.");

async function send(method: "GET" | "POST", path: string, workerUrl: string, token: string, body?: unknown, timeoutMs = 75_000): Promise<any> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new AiError("offline", MESSAGES.offline);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(workerUrl + path, {
      method, signal: ctrl.signal,
      headers: { "X-Access-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new AiError(aborted ? "timeout" : "network", MESSAGES[aborted ? "timeout" : "network"]);
  } finally { clearTimeout(timer); }
  let json: any = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || !json?.ok) {
    const code = typeof json?.error === "string" ? json.error : res.status === 404 ? "not_found" : "ai_unavailable";
    throw new AiError(code, aiErrorText(code));
  }
  return json;
}

async function call<T>(task: string, body: unknown, timeoutMs = 75_000): Promise<{ data: T; model: string }> {
  const s = await getAiSettings();
  if (!s.workerUrl || !s.accessToken) throw new AiError("not_configured_client", MESSAGES.not_configured_client);
  const url = normalizeWorkerUrl(s.workerUrl);
  const json = await send("POST", `/api/ai/${task}`, url, s.accessToken, body, timeoutMs);
  void addUsage(json.meta?.usage?.total ?? 0).catch(() => {});
  return { data: json.data as T, model: typeof json.meta?.model === "string" ? json.meta.model : "" };
}

export interface CourseInfo { title: string; subject: string; level: Level; goal: string; description: string }
export interface LessonProgression {
  position: number;
  total: number;
  previousLessons: { title: string; summary: string }[];
  nextLessons: string[];
}
export interface TeacherContext { courseTitle?: string; subject?: string; goal?: string; lessonTitle?: string; lessonText?: string }

export const generateOutline = (course: CourseInfo) =>
  call<{ chapters: { title: string; lessons: string[] }[] }>("outline", { course });

export const generateLesson = (course: CourseInfo, chapterTitle: string, lessonTitle: string, instruction = "", progression?: LessonProgression) =>
  call<LessonContent>("lesson", { course, chapterTitle, lessonTitle, instruction, progression }, 210_000);

export async function askTeacher(level: Level, context: TeacherContext, history: Pick<ChatMessage, "role" | "content">[]): Promise<string> {
  const r = await call<{ reply: string }>("chat", { level, context, messages: history.slice(-12) });
  return r.data.reply;
}

export const checkAnswer = (p: { lessonTitle: string; level: Level; question: string; learnerAnswer: string; sampleAnswer: string }) =>
  call<{ verdict: "correct" | "partial" | "incorrect"; feedback: string }>("check", p);

/** Used by the Settings page: verifies URL + token and whether the Worker has its AI key. */
export async function testConnection(workerUrl: string, token: string): Promise<{ aiConfigured: boolean }> {
  const url = normalizeWorkerUrl(workerUrl);
  if (!url || !token.trim()) throw new AiError("not_configured_client", MESSAGES.not_configured_client);
  const json = await send("GET", "/api/status", url, token.trim(), undefined, 15_000);
  return { aiConfigured: !!json.aiConfigured };
}
