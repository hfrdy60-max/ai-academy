-- AI Academy D1 foundation: accounts, one-time email verification, sessions and per-user data.
-- Apply only after creating a D1 database and configuring its binding in wrangler.toml.
-- Timestamps are Unix milliseconds. Verification codes and session tokens are NEVER stored in plaintext.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (length(id) BETWEEN 16 AND 80),
  CHECK (length(email) BETWEEN 5 AND 254)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (length(email) BETWEEN 5 AND 254),
  CHECK (length(code_hash) = 64),
  CHECK (attempts BETWEEN 0 AND 10)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (length(token_hash) = 64),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_courses (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_courses_updated
  ON user_courses(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_chats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_user_chats_updated
  ON user_chats(user_id, updated_at DESC);
