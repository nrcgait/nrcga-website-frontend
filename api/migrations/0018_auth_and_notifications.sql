-- Password reset tokens and per-staff notification preferences

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  event_mode TEXT NOT NULL DEFAULT 'none' CHECK (event_mode IN ('none', 'all', 'selected')),
  form_mode TEXT NOT NULL DEFAULT 'none' CHECK (form_mode IN ('none', 'all', 'selected')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_event_notification_subs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_notify_subs_event ON user_event_notification_subs(event_id);

CREATE TABLE IF NOT EXISTS user_inbox_notification_subs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inbox_key TEXT NOT NULL,
  PRIMARY KEY (user_id, inbox_key)
);

CREATE INDEX IF NOT EXISTS idx_inbox_notify_subs_inbox ON user_inbox_notification_subs(inbox_key);
