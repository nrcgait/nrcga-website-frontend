-- Trainer role, committee-linked events and content

ALTER TABLE events ADD COLUMN committee_slug TEXT;
ALTER TABLE programs ADD COLUMN committee_slug TEXT;
ALTER TABLE archive_items ADD COLUMN committee_slug TEXT;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'chair', 'user', 'trainer')),
  display_name TEXT,
  member_id TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, password_salt, role, display_name, member_id, created_at, updated_at)
SELECT id, email, password_hash, password_salt, role, display_name, member_id, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_committee ON events (committee_slug);
CREATE INDEX IF NOT EXISTS idx_programs_committee ON programs (committee_slug);
