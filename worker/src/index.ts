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
  let res;
  if (task === "outline") {
    const course = parseOutline(body).course;
    const total = course.level === "advanced" ? 20 : course.level === "intermediate" ? 10 : 5;
    const chapters: { title: string; lessons: string[] }[] = [];
    const outlineUsage = { prompt: 0, completion: 0, total: 0 };
    // Generate five chapters per request. Smaller, ordered segments avoid output
    // truncation and chapter-count drift on large 100-lesson curricula.
    for (let start = 1; start <= total; start += 5) {
      const batchMessages = outlineMessages(course, { start, count: 5 });
      let batchResult: { title: string; lessons: string[] }[] | null = null;
      let lastText = "";
      for (let attempt = 0; attempt < 2 && !batchResult; attempt++) {
        const requestMessages = attempt === 0 ? batchMessages : [
          ...batchMessages,
          { role: "assistant" as const, content: lastText.slice(0, 18000) },
          { role: "user" as const, content: "اصلاح: فقط ۵ فصل همین بازه را برگردان. هر فصل دقیقاً ۵ عنوان درس غیرتکراری داشته باشد. فقط JSON معتبر و کامل." }
        ];
        res = await provider.complete({ model, messages: requestMessages, maxTokens: 7000, temperature: attempt ? 0.15 : 0.25 });
        lastText = res.text;
        if (res.usage) {
          outlineUsage.prompt += res.usage.prompt;
          outlineUsage.completion += res.usage.completion;
          outlineUsage.total += res.usage.total;
        }
        try {
          if (res.finishReason === "length") throw new Error("truncated");
          const parsed = extractJson(res.text) as any;
          if (!parsed || !Array.isArray(parsed.chapters)) throw new HttpError(502, "ai_outline_incomplete");
          // Some providers ignore the requested segment and return the entire
          // curriculum. Accept that valid shape and take only this ordered slice.
          const segment = parsed.chapters.length === total
            ? parsed.chapters.slice(start - 1, start - 1 + 5)
            : parsed.chapters;
          const checked = validateOutline({ chapters: segment }, "beginner");
          if (checked.chapters.length !== 5) throw new HttpError(502, "ai_outline_incomplete");
          batchResult = checked.chapters;
        } catch (error) {
          if (attempt === 1) {
            if (error instanceof HttpError && error.code === "ai_bad_output") throw error;
            throw new HttpError(502, "ai_outline_incomplete");
          }
        }
      }
      if (!batchResult) throw new HttpError(502, "ai_outline_incomplete");
      chapters.push(...batchResult);
    }
    const outline = validateOutline({ chapters }, course.level);
    return { data: outline, meta: { model: res!.model, finishReason: res!.finishReason ?? null, usage: outlineUsage.total ? outlineUsage : null } };
  }

  res = await provider.complete({ model, messages, maxTokens: s.maxTokens, temperature: s.temperature });
  if (task === "lesson") {
    try {
      if (res.finishReason === "length") throw new Error("truncated");
      return { data: finish(res.text), meta: { model: res.model, finishReason: res.finishReason ?? null, usage: res.usage ?? null } };
    } catch {
      // Ask the model to repair its own draft instead of rejecting a nearly complete lesson.
      const repairMessages = [
        ...messages,
        { role: "assistant" as const, content: res.text.slice(0, 26000) },
        { role: "user" as const, content: "خروجی قبلی ناقص یا کوتاه بود. همین درس را کامل و با عمق آموزشی لازم بازنویسی کن. تمام فیلدهای JSON را پر کن؛ حداقل طول توضیح و تعداد اهداف، مثال‌ها، نکته‌ها، تمرین‌ها و آزمون‌های خواسته‌شده در دستور سیستم را دقیق رعایت کن. فقط JSON معتبر برگردان و متن قبلی را خلاصه نکن." }
      ];
      const repaired = await provider.complete({ model, messages: repairMessages, maxTokens: s.maxTokens, temperature: 0.2 });
      if (repaired.finishReason === "length") throw new HttpError(502, "ai_output_truncated");
      return { data: finish(repaired.text), meta: { model: repaired.model, finishReason: repaired.finishReason ?? null, usage: repaired.usage ?? null } };
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

      if (url.pathname === "/api/status" && request.method === "GET") return json({ ok: true, aiConfigured: !!env.OPENROUTER_API_KEY }, 200, headers);

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
