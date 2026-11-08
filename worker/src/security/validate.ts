import { HttpError } from "./errors";
import type { Level } from "../types";

export const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];

// Control characters (except newline/tab) are removed from every string we accept or return.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export function str(v: unknown, field: string, max: number, opts: { optional?: boolean } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return "";
    throw new HttpError(400, `invalid_${field}`);
  }
  if (typeof v !== "string") throw new HttpError(400, `invalid_${field}`);
  const s = clean(v);
  if (!s && !opts.optional) throw new HttpError(400, `invalid_${field}`);
  if (s.length > max) throw new HttpError(400, `too_long_${field}`);
  return s;
}

export function level(v: unknown): Level {
  if (typeof v === "string" && (LEVELS as readonly string[]).includes(v)) return v as Level;
  throw new HttpError(400, "invalid_level");
}

export function obj(v: unknown, field: string): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  throw new HttpError(400, `invalid_${field}`);
}

export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  if (!(req.headers.get("Content-Type") ?? "").includes("application/json")) throw new HttpError(415, "unsupported_media_type");
  if (Number(req.headers.get("Content-Length") ?? "0") > maxBytes) throw new HttpError(413, "payload_too_large");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "empty_body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new HttpError(413, "payload_too_large"); }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(all)); }
  catch { throw new HttpError(400, "invalid_json"); }
}

export { clean };
