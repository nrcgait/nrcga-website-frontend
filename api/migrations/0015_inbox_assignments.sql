-- Per-inbox staff access (built-in keys: contact, applications, training, newsletter; or custom inbox slug)
CREATE TABLE IF NOT EXISTS inbox_user_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inbox_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, inbox_key)
);

CREATE INDEX IF NOT EXISTS idx_inbox_assignments_inbox ON inbox_user_assignments(inbox_key);
