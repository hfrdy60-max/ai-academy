-- Per-user exam and game history, synchronized across signed-in devices.
-- Keep only the latest 20 records of each type per account at the API layer.
CREATE TABLE IF NOT EXISTS user_results (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL CHECK (result_type IN ('exam', 'game')),
  result_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (user_id, result_type, result_id)
);
CREATE INDEX IF NOT EXISTS idx_user_results_recent
  ON user_results(user_id, result_type, updated_at DESC);
