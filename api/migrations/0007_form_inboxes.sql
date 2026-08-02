-- Custom form inboxes: admin-defined schemas that accept submissions on any page
CREATE TABLE IF NOT EXISTS form_inboxes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  fields_json TEXT NOT NULL DEFAULT '[]',
  submit_label TEXT NOT NULL DEFAULT 'Submit',
  success_message TEXT NOT NULL DEFAULT 'Thank you — your submission was received.',
  notify_email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_form_inboxes_active ON form_inboxes(active);
CREATE INDEX IF NOT EXISTS idx_form_inboxes_sort ON form_inboxes(sort_order);
