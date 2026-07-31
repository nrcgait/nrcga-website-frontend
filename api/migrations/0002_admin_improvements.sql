-- Admin improvements: roles, member linking, board members

ALTER TABLE members ADD COLUMN is_board_member INTEGER NOT NULL DEFAULT 0;

UPDATE members SET type = 'Stakeholder', is_board_member = 1 WHERE type = 'Director';

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'chair', 'user')),
  display_name TEXT,
  member_id TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, password_salt, role, display_name, created_at, updated_at)
SELECT id, email, password_hash, password_salt,
  CASE WHEN role = 'editor' THEN 'user' ELSE role END,
  display_name, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id) WHERE member_id IS NOT NULL;
