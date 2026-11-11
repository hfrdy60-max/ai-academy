// AI Academy Worker. The browser talks only to this Worker; AI keys never leave it.
import type { Env, Task } from "./types";
import { HttpError } from "./security/errors";
import { tokenMatches } from "./security/auth";
import { resolveSession } from "./account/session";
import { allowRequest } from "./security/rateLimit";
import { readJsonBody } from "./security/validate";
import { handleAccountRoute } from "./account/routes";
import { getProvider, modelFor } from "./providers";
import { parseChat, parseCheck, parseLesson, parseOutline } from "./agents/requests";
import { chatMessages, checkMessages, lessonMessages, outlineMessages } from "./agents/prompts";
import { extractJson, validateChatReply, validateCheck, validateLesson, validateOutline } from "./agents/schemas";

const MAX_BODY_BYTES = 128 * 1024;
const TASKS: readonly Task[] = ["outline", "lesson", "chat", "check"];
const SETTINGS: Record<Task, { maxTokens: number; temperature: number }> = {
  outline: { maxTokens: 14000, temperature: 0.25 }, lesson: { maxTokens: 6500, temperature: 0.4 },
  chat: { maxTokens: 1200, temperature: 0.6 }, check: { maxTokens: 600, temperature: 0.2 }
};

const baseHeaders = (): Record<string, string> => ({
  "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer"
});

function cors(origin: string | null, env: Env): Record<string, string> {
  if (origin && origin === env.ALLOWED_ORIGIN) { // exact match only, never a wildcard
    return {
      "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Access-Token, Authorization", "Access-Control-Max-Age": "600", Vary: "Origin"
    };
  }
  return { Vary: "Origin" };
}

function json(data: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...baseHeaders(), ...extra } });
}

async function runTask(task: Task, body: unknown, env: Env) {
  const provider = getProvider(env);
  const model = modelFor(env, task);
  const s = task === "lesson"
    ? (() => {
        const bodyObj = body && typeof body === "object" ? body as Record<string, unknown> : {};
        const courseObj = bodyObj.course && typeof bodyObj.course === "object" ? bodyObj.course as Record<string, unknown> : {};
        const courseLevel = courseObj.level;
        return { maxTokens: courseLevel === "advanced" ? 15000 : courseLevel === "intermediate" ? 10000 : 6500, temperature: SETTINGS.lesson.temperature };
      })()
    : SETTINGS[task];
  let messages;
  let finish: (t: string) => unknown;
  if (task === "outline") {
    const course = parseOutline(body).course;
    messages = outlineMessages(course);
    finish = t => validateOutline(extractJson(t), course.level);
  }
  else if (task === "lesson") {
    const r = parseLesson(body);
    messages = lessonMessages(r.course, r.chapterTitle, r.lessonTitle, r.instruction, r.progression); finish = t => validateLesson(extractJson(t), r.course.level);
  } else if (task === "check") {
    const r = parseCheck(body);
    messages = checkMessages(r.level, r.lessonTitle, r.question, r.learnerAnswer, r.sampleAnswer); finish = t => validateCheck(extractJson(t));
  } else {
    const r = parseChat(body);
    messages = chatMessages(r.level, r.context, r.messages); finish = t => ({ reply: validateChatReply(t) });
  }
  let res = await provider.complete({ model, messages, maxTokens: s.maxTokens, temperature: s.temperature });
  // A long outline can occasionally come back with a missing chapter or lesson.
  // Validate it, then make one focused repair attempt instead of forcing the learner
  // to restart the entire course creation flow.
  if (task === "outline") {
    let outline: unknown;
    try {
      if (res.finishReason === "length") throw new Error("truncated");
      outline = validateOutline(extractJson(res.text), (body as any)?.course?.level);
    } catch {
      const level = (body as any)?.course?.level;
      const expected = level === "advanced" ? "20 فصل و دقیقاً 100 درس" : level === "intermediate" ? "10 فصل و دقیقاً 50 درس" : "5 فصل و دقیقاً 25 درس";
      const repairMessages = [
        ...messages,
        { role: "assistant" as const, content: res.text.slice(0, 24000) },
        { role: "user" as const, content: `خروجی قبلی ناقص یا نامعتبر بود. آن را اصلاح کن و فقط JSON نهایی را برگردان. الزام قطعی: ${expected}، در هر فصل دقیقاً 5 درس. همه فصل‌ها و همه عنوان درس‌ها را کامل بنویس؛ هیچ توضیحی خارج از JSON نده. ساختار دقیق: {"chapters":[{"title":"...","lessons":["...","...","...","...","..."]}]}. از خروجی قبلی فقط بخش‌های معتبر را حفظ و تکمیل کن.` }
      ];
      res = await provider.complete({ model, messages: repairMessages, maxTokens: 14000, temperature: 0.15 });
      if (res.finishReason === "length") throw new HttpError(502, "ai_output_truncated");
      outline = validateOutline(extractJson(res.text), level);
    }
    return { data: outline, meta: { model: res.model, finishReason: res.finishReason ?? null, usage: res.usage ?? null } };
  }
  // A provider may return syntactically valid but incomplete JSON when its token
  // budget is exhausted. Do not present that as a complete lesson.
  if (task === "lesson" && res.finishReason === "length") {
    throw new HttpError(502, "ai_output_truncated");
  }
  return { data: finish(res.text), meta: { model: res.model, finishReason: res.finishReason ?? null, usage: res.usage ?? null } };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request.headers.get("Origin"), env);
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...baseHeaders(), ...headers } });
      if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "ai-academy-api", version: "0.4.0" }, 200, headers);

      // Account registration, email verification, sessions and user-scoped sync use
      // per-user bearer sessions; they do not depend on the legacy shared AI token.
      const accountResponse = await handleAccountRoute(request, env, url.pathname);
      if (accountResponse) {
        const responseHeaders = new Headers(accountResponse.headers);
        for (const [key, value] of Object.entries(baseHeaders())) responseHeaders.set(key, value);
        for (const [key, value] of Object.entries(headers)) responseHeaders.set(key, value);
        return new Response(accountResponse.body, { status: accountResponse.status, statusText: accountResponse.statusText, headers: responseHeaders });
      }

      const limit = Number(env.RATE_LIMIT_PER_MINUTE) || 30;
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (!allowRequest("ai:" + ip, limit)) throw new HttpError(429, "rate_limited");

      // Account sessions are preferred; shared-token support remains for older builds.
      const authorization = request.headers.get("Authorization") ?? "";
      if (/^Bearer /i.test(authorization)) {
        if (!env.DB) throw new HttpError(503, "database_not_configured");
        const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
        if (!match || !(await resolveSession(env.DB, match[1]))) throw new HttpError(401, "session_expired");
      } else {
        if (!env.ACCESS_TOKEN) throw new HttpError(503, "not_configured");
        if (!(await tokenMatches(request.headers.get("X-Access-Token"), env.ACCESS_TOKEN))) throw new HttpError(401, "unauthorized");
      }

      if (url.pathname === "/api/status" && request.method === "GET") return json({ ok: true, aiConfigured: !!env.OPENROUTER_API_KEY }, 200, headers);

      const m = /^\/api\/ai\/([a-z]+)$/.exec(url.pathname);
      if (m && request.method === "POST" && (TASKS as readonly string[]).includes(m[1])) {
        if (!env.OPENROUTER_API_KEY) throw new HttpError(503, "ai_not_configured");
        const body = await readJsonBody(request, MAX_BODY_BYTES);
        return json({ ok: true, ...(await runTask(m[1] as Task, body, env)) }, 200, headers);
      }
      throw new HttpError(404, "not_found");
    } catch (e) {
      if (e instanceof HttpError) return json({ ok: false, error: e.code }, e.status, headers);
      console.error("unhandled error"); // never echo internal details to the browser
      return json({ ok: false, error: "internal_error" }, 500, headers);
    }
  }
} satisfies ExportedHandler<Env>;
