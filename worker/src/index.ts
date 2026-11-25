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
import { extractJson, lessonQualityIssues, validateChatReply, validateCheck, validateLesson, validateOutline } from "./agents/schemas";

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
      "Access-Control-Allow-Headers": "Content-Type, X-Access-Token, Authorization, X-User-OpenRouter-Key", "Access-Control-Max-Age": "600", Vary: "Origin"
    };
  }
  return { Vary: "Origin" };
}

function json(data: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...baseHeaders(), ...extra } });
}

async function runTask(task: Task, body: unknown, env: Env) {
  const model = modelFor(env, task);
  const outlineRequest = task === "outline" ? parseOutline(body) : null;
  const isLessonTask = task === "lesson";
  // Lesson responses get a larger time budget; quality repairs are handled below.
  const requestEnv: Env = task === "outline"
    ? { ...env, UPSTREAM_TIMEOUT_MS: "45000", UPSTREAM_MAX_ATTEMPTS: "1" }
    : isLessonTask
      ? { ...env, UPSTREAM_TIMEOUT_MS: "65000", UPSTREAM_MAX_ATTEMPTS: "1" }
      : env;
  const provider = getProvider(requestEnv);
  const s = task === "lesson"
    ? (() => {
        const bodyObj = body && typeof body === "object" ? body as Record<string, unknown> : {};
        const courseObj = bodyObj.course && typeof bodyObj.course === "object" ? bodyObj.course as Record<string, unknown> : {};
        const courseLevel = courseObj.level;
        return { maxTokens: courseLevel === "advanced" ? 18000 : courseLevel === "intermediate" ? 13000 : 9000, temperature: SETTINGS.lesson.temperature };
      })()
    : SETTINGS[task];
  let messages;
  let finish: (t: string) => unknown;
  let lessonRepairHint: (draft: string) => string = () => "خروجی قبلی ناقص بود؛ همه فیلدهای لازم را کامل کن.";
  if (task === "outline") {
    const { course, range } = outlineRequest!;
    const total = course.level === "advanced" ? 20 : course.level === "intermediate" ? 10 : 5;
    const batch = range ?? { start: 1, count: total };
    messages = outlineMessages(course, batch);
    finish = t => validateOutline(extractJson(t), course.level, batch.count);
  }
  else if (task === "lesson") {
    const r = parseLesson(body);
    messages = lessonMessages(r.course, r.chapterTitle, r.lessonTitle, r.instruction, r.progression);
    finish = t => validateLesson(extractJson(t), r.course.level);
    lessonRepairHint = draft => {
      try {
        const issues = lessonQualityIssues(extractJson(draft), r.course.level);
        return issues.length
          ? `کمبودهای مشخص خروجی قبلی: ${issues.join("؛ ")}. فقط این کمبودها را برطرف کن و بخش‌های درست را حفظ کن.`
          : "قالب خروجی یا JSON معتبر نبود؛ یک شیء JSON کامل و معتبر بساز.";
      } catch {
        return "خروجی قبلی JSON معتبر نبود؛ یک شیء JSON کامل و معتبر بساز.";
      }
    };
  } else if (task === "check") {
    const r = parseCheck(body);
    messages = checkMessages(r.level, r.lessonTitle, r.question, r.learnerAnswer, r.sampleAnswer); finish = t => validateCheck(extractJson(t));
  } else {
    const r = parseChat(body);
    messages = chatMessages(r.level, r.context, r.messages); finish = t => ({ reply: validateChatReply(t) });
  }
  let res;
  if (task === "outline") {
    const { course, range } = outlineRequest!;
    const total = course.level === "advanced" ? 20 : course.level === "intermediate" ? 10 : 5;
    const batch = range ?? { start: 1, count: total };
    const maxTokens = batch.count * 1800;
    let lastResult: Awaited<ReturnType<typeof provider.complete>> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const requestMessages = attempt === 0 ? messages : [
        ...messages,
        { role: "assistant" as const, content: lastResult?.text.slice(0, 12000) ?? "" },
        { role: "user" as const, content: `اصلاح خروجی: فقط فصل‌های شماره ${batch.start} تا ${batch.start + batch.count - 1} را برگردان. دقیقاً ${batch.count} فصل و برای هر فصل دقیقاً ۵ عنوان درس متمایز ارائه کن. فقط JSON معتبر.` }
      ];
      lastResult = await provider.complete({ model, messages: requestMessages, maxTokens, temperature: attempt ? 0.15 : 0.25 });
      try {
        if (lastResult.finishReason === "length") throw new HttpError(502, "ai_outline_incomplete");
        const parsed = extractJson(lastResult.text) as any;
        if (!parsed || !Array.isArray(parsed.chapters)) throw new HttpError(502, "ai_outline_incomplete");
        const segment = parsed.chapters.length === total
          ? parsed.chapters.slice(batch.start - 1, batch.start - 1 + batch.count)
          : parsed.chapters;
        const checked = validateOutline({ chapters: segment }, course.level, batch.count);
        return { data: checked, meta: { model: lastResult.model, finishReason: lastResult.finishReason ?? null, usage: lastResult.usage ?? null } };
      } catch (error) {
        if (attempt === 1) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(502, "ai_outline_incomplete");
        }
      }
    }
    throw new HttpError(502, "ai_outline_incomplete");
  }

  res = await provider.complete({ model, messages, maxTokens: s.maxTokens, temperature: s.temperature });
  if (task === "lesson") {
    try {
      if (res.finishReason === "length") throw new Error("truncated");
      return { data: finish(res.text), meta: { model: res.model, finishReason: res.finishReason ?? null, usage: res.usage ?? null } };
    } catch {
      // Some models return a useful but undersized first draft. Repair the exact
      // missing fields, then allow one final expanded repair before rejecting it.
      let draft = res;
      for (let attempt = 0; attempt < 2; attempt++) {
        const repairMessages = [
          ...messages,
          { role: "assistant" as const, content: draft.text.slice(0, 26000) },
          { role: "user" as const, content: `خروجی قبلی این ایرادها را داشت: ${lessonRepairHint(draft.text)} متن درس را دقیقاً برای همین عنوان اصلاح کن. بخش‌های درست را حفظ کن، فقط کمبودها را با آموزش واقعی و مرتبط کامل کن، همه فیلدهای JSON را نگه دار و فقط JSON معتبر برگردان.` }
        ];
        const repairMaxTokens = attempt === 0 ? s.maxTokens : Math.min(20000, Math.round(s.maxTokens * 1.25));
        draft = await provider.complete({ model, messages: repairMessages, maxTokens: repairMaxTokens, temperature: 0.2 });
        try {
          if (draft.finishReason === "length") throw new HttpError(502, "ai_output_truncated");
          return { data: finish(draft.text), meta: { model: draft.model, finishReason: draft.finishReason ?? null, usage: draft.usage ?? null } };
        } catch (error) {
          if (attempt === 1) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(502, "ai_bad_output");
          }
        }
      }
    }
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

      if (url.pathname === "/api/status" && request.method === "GET") {
        const personalKey = request.headers.get("X-User-OpenRouter-Key")?.trim() ?? "";
        const personalKeyShapeValid = /^sk-or-v1-[a-f0-9]{20,}$/i.test(personalKey) && personalKey.length <= 300;
        return json({ ok: true, aiConfigured: !!env.OPENROUTER_API_KEY || personalKeyShapeValid }, 200, headers);
      }

      const m = /^\/api\/ai\/([a-z]+)$/.exec(url.pathname);
      if (m && request.method === "POST" && (TASKS as readonly string[]).includes(m[1])) {
        const personalKey = request.headers.get("X-User-OpenRouter-Key")?.trim() ?? "";
        if (personalKey && (!/^sk-or-v1-[a-f0-9]{20,}$/i.test(personalKey) || personalKey.length > 300)) throw new HttpError(400, "invalid_user_api_key");
        const selectedKey = personalKey || env.OPENROUTER_API_KEY;
        if (!selectedKey) throw new HttpError(503, "ai_not_configured");
        const body = await readJsonBody(request, MAX_BODY_BYTES);
        // Request-scoped copy: never persist or log personal credentials.
        return json({ ok: true, ...(await runTask(m[1] as Task, body, { ...env, OPENROUTER_API_KEY: selectedKey })) }, 200, headers);
      }
      throw new HttpError(404, "not_found");
    } catch (e) {
      if (e instanceof HttpError) return json({ ok: false, error: e.code }, e.status, headers);
      console.error("unhandled error"); // never echo internal details to the browser
      return json({ ok: false, error: "internal_error" }, 500, headers);
    }
  }
} satisfies ExportedHandler<Env>;
