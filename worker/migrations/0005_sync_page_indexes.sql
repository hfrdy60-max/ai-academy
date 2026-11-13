-- Cover the deterministic ordering used by offset-paginated account synchronization.
-- The existing updated_at indexes remain useful for other maintenance/reporting queries.
CREATE INDEX IF NOT EXISTS idx_user_courses_sync_page
  ON user_courses(user_id, created_at ASC, course_id ASC);

CREATE INDEX IF NOT EXISTS idx_user_chats_sync_page
  ON user_chats(user_id, created_at ASC, thread_id ASC);

CREATE INDEX IF NOT EXISTS idx_user_tombstones_sync_page
  ON user_tombstones(user_id, deleted_at DESC, record_type ASC, record_id ASC);
