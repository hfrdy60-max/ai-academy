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

const MAX_RECORD_BYTES = 1_500_000;

function assertId(value: string, code: string): void {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      value.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(code);
  }
}

function assertUserId(value: string): void {
  if (typeof value !== "string" || value.length < 16 || value.length > 80 ||
      value.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(value)) {
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
  const payloadUpdatedAt = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).updatedAt : undefined;
  const safeUpdatedAt = Number.isSafeInteger(payloadUpdatedAt) && (payloadUpdatedAt as number) >= 0 ? payloadUpdatedAt as number : now;
  await db.prepare("DELETE FROM user_tombstones WHERE user_id = ? AND record_type = 'course' AND record_id = ? AND deleted_at < ?")
    .bind(userId, courseId, safeUpdatedAt).run();
  await db.prepare(
    "INSERT INTO user_courses (user_id, course_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, course_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at " +
    "WHERE CAST(json_extract(user_courses.payload, '$.updatedAt') AS INTEGER) <= CAST(json_extract(excluded.payload, '$.updatedAt') AS INTEGER) " +
    "AND NOT EXISTS (SELECT 1 FROM user_tombstones WHERE user_id = ? AND record_type = 'course' AND record_id = ? AND deleted_at >= ?)"
  ).bind(userId, courseId, serialized, now, safeUpdatedAt, userId, courseId, safeUpdatedAt).run();
}

export async function listUserCourses(db: D1Database, userId: string, limit = 100, offset = 0): Promise<StoredRecord[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(200, Math.max(1, limit)) : 100;
  const safeOffset = Number.isSafeInteger(offset) ? Math.min(1_000_000, Math.max(0, offset)) : 0;
  const result = await db.prepare(
    "SELECT course_id AS id, payload, created_at, updated_at FROM user_courses " +
    "WHERE user_id = ? ORDER BY updated_at DESC, course_id ASC LIMIT ? OFFSET ?"
  ).bind(userId, safeLimit, safeOffset).all<{ id: string; payload: string; created_at: number; updated_at: number }>();
  return parseRecords(result.results ?? []);
}

export async function putUserChat(
  db: D1Database, userId: string, threadId: string, payload: unknown, now: number
): Promise<void> {
  assertUserId(userId);
  assertId(threadId, "invalid_record_id");
  const serialized = serializePayload(payload);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid_timestamp");
  const payloadUpdatedAt = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).updatedAt : undefined;
  const safeUpdatedAt = Number.isSafeInteger(payloadUpdatedAt) && (payloadUpdatedAt as number) >= 0
    ? payloadUpdatedAt as number : now;
  await db.prepare("DELETE FROM user_tombstones WHERE user_id = ? AND record_type = 'chat' AND record_id = ? AND deleted_at < ?")
    .bind(userId, threadId, safeUpdatedAt).run();
  await db.prepare(
    "INSERT INTO user_chats (user_id, thread_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, thread_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at " +
    "WHERE CAST(json_extract(user_chats.payload, '$.updatedAt') AS INTEGER) <= CAST(json_extract(excluded.payload, '$.updatedAt') AS INTEGER) " +
    "AND NOT EXISTS (SELECT 1 FROM user_tombstones WHERE user_id = ? AND record_type = 'chat' AND record_id = ? AND deleted_at >= ?)"
  ).bind(userId, threadId, serialized, now, safeUpdatedAt, userId, threadId, safeUpdatedAt).run();
}

export async function listUserChats(db: D1Database, userId: string, limit = 100, offset = 0): Promise<StoredRecord[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(200, Math.max(1, limit)) : 100;
  const safeOffset = Number.isSafeInteger(offset) ? Math.min(1_000_000, Math.max(0, offset)) : 0;
  const result = await db.prepare(
    "SELECT thread_id AS id, payload, created_at, updated_at FROM user_chats " +
    "WHERE user_id = ? ORDER BY updated_at DESC, thread_id ASC LIMIT ? OFFSET ?"
  ).bind(userId, safeLimit, safeOffset).all<{ id: string; payload: string; created_at: number; updated_at: number }>();
  return parseRecords(result.results ?? []);
}

export interface StoredTombstone { record_type: "course" | "chat"; record_id: string; deleted_at: number; }

export async function putUserTombstone(
  db: D1Database, userId: string, type: "course" | "chat", recordId: string, deletedAt: number
): Promise<void> {
  assertUserId(userId);
  assertId(recordId, "invalid_record_id");
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) throw new Error("invalid_timestamp");
  await db.prepare(
    "INSERT INTO user_tombstones (user_id, record_type, record_id, deleted_at) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(user_id, record_type, record_id) DO UPDATE SET deleted_at = MAX(user_tombstones.deleted_at, excluded.deleted_at)"
  ).bind(userId, type, recordId, deletedAt).run();
  if (type === "course") {
    await db.prepare("DELETE FROM user_courses WHERE user_id = ? AND course_id = ? AND CAST(json_extract(payload, '$.updatedAt') AS INTEGER) <= ?")
      .bind(userId, recordId, deletedAt).run();
  } else {
    await db.prepare("DELETE FROM user_chats WHERE user_id = ? AND thread_id = ? AND CAST(json_extract(payload, '$.updatedAt') AS INTEGER) <= ?")
      .bind(userId, recordId, deletedAt).run();
  }
}

export async function listUserTombstones(db: D1Database, userId: string, limit = 1000, offset = 0): Promise<StoredTombstone[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(2000, Math.max(1, limit)) : 1000;
  const safeOffset = Number.isSafeInteger(offset) ? Math.min(1_000_000, Math.max(0, offset)) : 0;
  const result = await db.prepare(
    "SELECT record_type, record_id, deleted_at FROM user_tombstones WHERE user_id = ? ORDER BY deleted_at DESC, record_type ASC, record_id ASC LIMIT ? OFFSET ?"
  ).bind(userId, safeLimit, safeOffset).all<StoredTombstone>();
  return (result.results ?? []).filter(row =>
    (row.record_type === "course" || row.record_type === "chat") &&
    typeof row.record_id === "string" && Number.isSafeInteger(row.deleted_at) && row.deleted_at >= 0
  );
}

export interface StoredUserResult {
  id: string;
  result_type: "exam" | "game";
  payload: unknown;
  created_at: number;
  updated_at: number;
}

export async function putUserResult(
  db: D1Database, userId: string, type: "exam" | "game", resultId: string, payload: unknown, now: number
): Promise<void> {
  assertUserId(userId);
  assertId(resultId, "invalid_record_id");
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("invalid_timestamp");
  const serialized = serializePayload(payload);
  if (!payload || typeof payload !== "object" ||
      !Number.isSafeInteger((payload as Record<string, unknown>).date) ||
      ((payload as Record<string, unknown>).date as number) < 0) {
    throw new Error("invalid_result_timestamp");
  }
  const resultDate = (payload as Record<string, unknown>).date as number;
  await db.prepare(
    "INSERT INTO user_results (user_id, result_type, result_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, result_type, result_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at " +
    "WHERE user_results.updated_at <= excluded.updated_at"
  ).bind(userId, type, resultId, serialized, now, resultDate).run();
}

export async function listUserResults(db: D1Database, userId: string, limit = 40): Promise<StoredUserResult[]> {
  assertUserId(userId);
  const safeLimit = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 40;
  const result = await db.prepare(
    "SELECT result_id AS id, result_type, payload, created_at, updated_at FROM user_results " +
    "WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
  ).bind(userId, safeLimit).all<StoredUserResult>();
  return (result.results ?? []).map(row => {
    let payload: unknown;
    try { payload = JSON.parse(row.payload as unknown as string); }
    catch { throw new Error("stored_payload_invalid"); }
    return { ...row, payload };
  }).filter(row => row.result_type === "exam" || row.result_type === "game");
}

export async function trimUserResults(db: D1Database, userId: string, type: "exam" | "game", keep = 20): Promise<void> {
  assertUserId(userId);
  const safeKeep = Number.isInteger(keep) ? Math.min(50, Math.max(1, keep)) : 20;
  await db.prepare(
    "DELETE FROM user_results WHERE user_id = ? AND result_type = ? AND result_id NOT IN (" +
    "SELECT result_id FROM user_results WHERE user_id = ? AND result_type = ? ORDER BY updated_at DESC LIMIT ?)"
  ).bind(userId, type, userId, type, safeKeep).run();
}

export interface StoredUserProfile {
  payload: { displayName: string; dailyGoal: number };
  updated_at: number;
}

export async function getUserProfile(db: D1Database, userId: string): Promise<StoredUserProfile | null> {
  assertUserId(userId);
  const row = await db.prepare(
    "SELECT payload, updated_at FROM user_profiles WHERE user_id = ? LIMIT 1"
  ).bind(userId).first<{ payload: string; updated_at: number }>();
  if (!row) return null;
  let payload: unknown;
  try { payload = JSON.parse(row.payload); }
  catch { throw new Error("stored_payload_invalid"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("stored_payload_invalid");
  const p = payload as Record<string, unknown>;
  if (typeof p.displayName !== "string" || !Number.isInteger(p.dailyGoal)) throw new Error("stored_payload_invalid");
  return { payload: { displayName: p.displayName, dailyGoal: p.dailyGoal as number }, updated_at: row.updated_at };
}

export async function putUserProfile(
  db: D1Database, userId: string, profile: { displayName: string; dailyGoal: number }, updatedAt: number
): Promise<void> {
  assertUserId(userId);
  if (!profile || typeof profile.displayName !== "string" || profile.displayName.length > 40 ||
      !Number.isInteger(profile.dailyGoal) || profile.dailyGoal < 1 || profile.dailyGoal > 10 ||
      !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error("invalid_profile");
  }
  const serialized = serializePayload(profile);
  await db.prepare(
    "INSERT INTO user_profiles (user_id, payload, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at " +
    "WHERE user_profiles.updated_at <= excluded.updated_at"
  ).bind(userId, serialized, updatedAt).run();
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
