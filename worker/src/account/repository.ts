import { normalizeEmail } from "./crypto";

export interface AccountUser {
  id: string;
  email: string;
  created_at: number;
  updated_at: number;
}

export interface ActiveSession {
  token_hash: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  email: string;
}

export interface StoredRecord {
  id: string;
  payload: unknown;
  created_at: number;
  updated_at: number;
}

const MAX_RECORD_BYTES = 256 * 1024;

function assertId(value: string, code: string): void {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      value.trim().length === 0 || /[\\u0000-\\u001f\\u007f]/.test(value)) {
    throw new Error(code);
  }
}

function assertUserId(value: string): void {
  if (typeof value !== "string" || value.length < 16 || value.length > 80) {
    throw new Error("invalid_user_id");
  }
}

function serializePayload(payload: unknown): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error("invalid_payload");
  }
  if (typeof serialized !== "string" || serialized.length === 0 ||
      new TextEncoder().encode(serialized).byteLength > MAX_RECORD_BYTES) {
    throw new Error("invalid_payload");
  }
  return serialized;
}

function parseRecords(rows: Array<{ id: string; payload: string; created_at: number; updated_at: number }>): StoredRecord[] {
  return rows.map(row => {
    let payload: unknown;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      throw new Error("stored_payload_invalid");
    }
    return { id: row.id, payload, created_at: row.created_at, updated_at: row.updated_at };
  });
}

/** All account queries are scoped by the authenticated user's own id. */
export async function findUserByEmail(db: D1Database, value: unknown): Promise<AccountUser | null> {
  const email = normalizeEmail(value);
  return db.prepare(
    "SELECT id, email, created_at, updated_at FROM users WHERE email = ? LIMIT 1"
  ).bind(email).first<AccountUser>();
}

export async function insertUser(db: D1Database, id: string, value: unknown, now: number): Promise<void> {
  assertUserId(id);
  const email = normalizeEmail(value);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid_timestamp");
  await db.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).bind(id, email, now, now).run();
}

export async function createSession(
  db: D1Database, tokenHash: string, userId: string, createdAt: number, expiresAt: number
): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(tokenHash)) throw new Error("invalid_token_hash");
  assertUserId(userId);
  if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(expiresAt) ||
      createdAt < 0 || expiresAt <= createdAt) throw new Error("invalid_session_expiry");
  await db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash.toLowerCase(), userId, createdAt, expiresAt).run();
}

export async function findActiveSession(db: D1Database, tokenHash: string, now: number): Promise<ActiveSession | null> {
  if (!/^[a-f0-9]{64}$/i.test(tokenHash) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("invalid_session_lookup");
  }
  return db.prepare(
    "SELECT s.token_hash, s.user_id, s.created_at, s.expires_at, u.email " +
    "FROM sessions s INNER JOIN users u ON u.id = s.user_id " +
    "WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1"
  ).bind(tokenHash.toLowerCase(), now).first<ActiveSession>();
}

export async function revokeSession(db: D1Database, tokenHash: string, now: number): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(tokenHash) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("invalid_session_lookup");
  }
  await db.prepare(
    "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL"
  ).bind(now, tokenHash.toLowerCase()).run();
}

export async function putUserCourse(
  db: D1Database, userId: string, courseId: string, payload: unknown, now: number
): Promise<void> {
  assertUserId(userId);
  assertId(courseId, "invalid_record_id");
  const serialized = serializePayload(payload);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid_timestamp");
  await db.prepare(
    "INSERT INTO user_courses (user_id, course_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, course_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
  ).bind(userId, courseId, serialized, now, now).run();
}

export async function listUserCourses(db: D1Database, userId: string, limit = 100): Promise<StoredRecord[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(200, Math.max(1, limit)) : 100;
  const result = await db.prepare(
    "SELECT course_id AS id, payload, created_at, updated_at FROM user_courses " +
    "WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
  ).bind(userId, safeLimit).all<{ id: string; payload: string; created_at: number; updated_at: number }>();
  return parseRecords(result.results ?? []);
}

export async function putUserChat(
  db: D1Database, userId: string, threadId: string, payload: unknown, now: number
): Promise<void> {
  assertUserId(userId);
  assertId(threadId, "invalid_record_id");
  const serialized = serializePayload(payload);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid_timestamp");
  await db.prepare(
    "INSERT INTO user_chats (user_id, thread_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, thread_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
  ).bind(userId, threadId, serialized, now, now).run();
}

export async function listUserChats(db: D1Database, userId: string, limit = 100): Promise<StoredRecord[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(200, Math.max(1, limit)) : 100;
  const result = await db.prepare(
    "SELECT thread_id AS id, payload, created_at, updated_at FROM user_chats " +
    "WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
  ).bind(userId, safeLimit).all<{ id: string; payload: string; created_at: number; updated_at: number }>();
  return parseRecords(result.results ?? []);
}

export async function saveEmailVerification(
  db: D1Database, value: unknown, codeHash: string, createdAt: number, expiresAt: number
): Promise<void> {
  const email = normalizeEmail(value);
  if (!/^[a-f0-9]{64}$/i.test(codeHash)) throw new Error("invalid_verification_hash");
  if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(expiresAt) ||
      createdAt < 0 || expiresAt <= createdAt) throw new Error("invalid_verification_expiry");
  await db.prepare(
    "INSERT INTO email_verifications (email, code_hash, expires_at, attempts, created_at, consumed_at) " +
    "VALUES (?, ?, ?, 0, ?, NULL) ON CONFLICT(email) DO UPDATE SET " +
    "code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, " +
    "created_at = excluded.created_at, consumed_at = NULL"
  ).bind(email, codeHash.toLowerCase(), expiresAt, createdAt).run();
}

/**
 * Consume a one-time email token. A wrong token increments the bounded attempt
 * counter; a correct token can be consumed only once and only before expiry.
 * Callers should rate-limit requests independently by IP and normalized email.
 */
export async function consumeEmailVerification(
  db: D1Database, value: unknown, codeHash: string, now: number
): Promise<boolean> {
  const email = normalizeEmail(value);
  if (!/^[a-f0-9]{64}$/i.test(codeHash) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error("invalid_verification_lookup");
  }
  const digest = codeHash.toLowerCase();
  const consumed = await db.prepare(
    "UPDATE email_verifications SET consumed_at = ? " +
    "WHERE email = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 10"
  ).bind(now, email, digest, now).run();
  if ((consumed.meta?.changes ?? 0) > 0) return true;

  await db.prepare(
    "UPDATE email_verifications SET attempts = attempts + 1 " +
    "WHERE email = ? AND code_hash <> ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 10"
  ).bind(email, digest, now).run();
  return false;
}
