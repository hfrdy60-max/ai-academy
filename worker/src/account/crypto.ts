/** Account-security primitives for opaque verification and session tokens.
 * Store only the SHA-256 digest in D1; return the random token to the client once.
 */
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_email");
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid_email");
  }
  return email;
}

/** Generate 256 bits of cryptographically secure entropy as 64 lowercase hex chars. */
export function createOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest suitable for storing instead of a raw session/code token. */
export async function hashOpaqueToken(token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("invalid_token");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison for fixed-size SHA-256 hex digests. */
export function digestMatches(provided: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(provided) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= provided.toLowerCase().charCodeAt(i) ^ expected.toLowerCase().charCodeAt(i);
  return diff === 0;
}
