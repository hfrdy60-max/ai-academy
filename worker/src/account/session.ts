import { createOpaqueToken, hashOpaqueToken } from "./crypto";
import { createSession, findActiveSession, revokeSession, type ActiveSession } from "./repository";

/** Default session lifetime: seven days. Callers may choose a shorter lifetime. */
export const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create a session and return its raw token exactly once.
 * Persist only the SHA-256 digest; callers must deliver the token through a
 * secure, HttpOnly cookie when an HTTP auth flow is eventually implemented.
 */
export async function issueSession(
  db: D1Database,
  userId: string,
  now = Date.now(),
  ttlMs = DEFAULT_SESSION_TTL_MS
): Promise<{ token: string; expiresAt: number }> {
  if (!Number.isSafeInteger(now) || now < 0 ||
      !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_SESSION_TTL_MS ||
      !Number.isSafeInteger(now + ttlMs)) {
    throw new Error("invalid_session_expiry");
  }

  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = now + ttlMs;
  await createSession(db, tokenHash, userId, now, expiresAt);
  return { token, expiresAt };
}

/** Resolve a raw opaque token to its active account; never accept a user id from the caller. */
export async function resolveSession(
  db: D1Database,
  token: string,
  now = Date.now()
): Promise<ActiveSession | null> {
  if (!/^[a-f0-9]{64}$/i.test(token) || !Number.isSafeInteger(now) || now < 0) {
    return null;
  }
  return findActiveSession(db, await hashOpaqueToken(token), now);
}

/** Revoke the session represented by a raw token. */
export async function revokeSessionToken(
  db: D1Database,
  token: string,
  now = Date.now()
): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(token) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("invalid_session_token");
  }
  await revokeSession(db, await hashOpaqueToken(token), now);
}
