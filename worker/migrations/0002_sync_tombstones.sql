-- Durable per-user deletion markers prevent removed records from reappearing on another device.
-- Apply after 0001_auth_and_sync.sql.
CREATE TABLE IF NOT EXISTS user_tombstones (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('course', 'chat')),
  record_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL CHECK (deleted_at >= 0),
  PRIMARY KEY (user_id, record_type, record_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tombstones_updated
  ON user_tombstones(user_id, deleted_at DESC);
