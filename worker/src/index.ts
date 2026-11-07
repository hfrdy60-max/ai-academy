// AI Academy Worker - audit scaffold.
// Only a health endpoint exists. No AI provider is called yet (Milestone 3).

export interface Env {
  ALLOWED_ORIGIN: string; // e.g. https://user.github.io  (origin only, no path)
}

const MAX_BODY_BYTES = 64 * 1024;

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer"
  };
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  // Only the configured frontend origin is allowed. No wildcard.
  if (origin && origin === env.ALLOWED_ORIGIN) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin"
    };
  }
  return { Vary: "Origin" };
}

function json(data: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...securityHeaders(), ...extra }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"), env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...securityHeaders(), ...cors } });
    }

    const declared = Number(request.headers.get("Content-Length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
      return json({ ok: false, error: "payload_too_large" }, 413, cors);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "ai-academy-api", version: "0.1.0" }, 200, cors);
    }

    return json({ ok: false, error: "not_found" }, 404, cors);
  }
} satisfies ExportedHandler<Env>;
