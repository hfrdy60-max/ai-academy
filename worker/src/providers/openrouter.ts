import type { Env } from "../types";
import { HttpError } from "../security/errors";
import type { AiProvider, CompleteOptions, CompletionResult } from "./types";

const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function baseUrl(env: Env): string {
  const u = (env.OPENROUTER_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  if (u.startsWith("https://") || u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) return u;
  throw new HttpError(500, "bad_server_config");
}

export function createOpenRouter(env: Env): AiProvider {
  const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS) || 50_000;
  const retryBase = env.UPSTREAM_RETRY_BASE_MS !== undefined ? Number(env.UPSTREAM_RETRY_BASE_MS) : 400;
  const maxAttempts = 3;

  return {
    async complete(opts: CompleteOptions): Promise<CompletionResult> {
      const key = env.OPENROUTER_API_KEY;
      if (!key) throw new HttpError(503, "ai_not_configured");
      const url = `${baseUrl(env)}/chat/completions`;
      let lastStatus = 502;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            method: "POST",
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "AI Academy" },
            body: JSON.stringify({ model: opts.model, messages: opts.messages, max_tokens: opts.maxTokens, temperature: opts.temperature })
          });
          if (res.ok) {
            const data = (await res.json()) as any;
            const text = data?.choices?.[0]?.message?.content;
            if (typeof text !== "string" || !text.trim()) throw new HttpError(502, "ai_empty_response");
            const u = data?.usage;
            return {
              text,
              model: typeof data?.model === "string" ? data.model : opts.model,
              usage: u && typeof u.total_tokens === "number"
                ? { prompt: Number(u.prompt_tokens) || 0, completion: Number(u.completion_tokens) || 0, total: u.total_tokens } : undefined
            };
          }
          lastStatus = res.status;
          console.error("ai upstream status", res.status); // status only: never log keys or bodies
          if (res.status === 401 || res.status === 403) throw new HttpError(502, "ai_auth_failed");
          if (!RETRYABLE.has(res.status)) throw new HttpError(502, "ai_unavailable");
          if (attempt < maxAttempts) {
            const ra = Number(res.headers.get("Retry-After"));
            await sleep(ra > 0 ? Math.min(ra * 1000, 3000) : retryBase * 2 ** (attempt - 1));
          }
        } catch (e) {
          if (e instanceof HttpError) throw e;
          const aborted = e instanceof Error && e.name === "AbortError";
          console.error("ai upstream error", aborted ? "timeout" : "network");
          lastStatus = aborted ? 504 : 502;
          if (attempt < maxAttempts) await sleep(retryBase * 2 ** (attempt - 1));
        } finally {
          clearTimeout(timer);
        }
      }
      if (lastStatus === 429) throw new HttpError(429, "ai_rate_limited");
      if (lastStatus === 504) throw new HttpError(504, "ai_timeout");
      throw new HttpError(502, "ai_unavailable");
    }
  };
}
