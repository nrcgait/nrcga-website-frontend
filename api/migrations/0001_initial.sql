-- NRCGA CMS initial schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'chair')),
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chair_committee_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  committee_slug TEXT NOT NULL,
  PRIMARY KEY (user_id, committee_slug)
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  company_name TEXT NOT NULL,
  stakeholder_group TEXT,
  voting_member TEXT,
  website TEXT,
  category TEXT,
  term TEXT,
  contact_person TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS archive_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('meeting-minute', 'historical-document')),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  link TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id TEXT PRIMARY KEY,
  image_r2_key TEXT,
  image_url TEXT,
  alt_text TEXT,
  link_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS committee_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS committee_memberships (
  member_id TEXT NOT NULL REFERENCES committee_members(id) ON DELETE CASCADE,
  committee_id TEXT NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  role INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, committee_id)
);

CREATE TABLE IF NOT EXISTS zero_damages (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  section_label TEXT,
  subtitle TEXT,
  body_md TEXT,
  body_json TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_items (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer_md TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS embeds (
  id TEXT PRIMARY KEY,
  page_slug TEXT NOT NULL,
  embed_type TEXT NOT NULL CHECK (embed_type IN ('ms_forms', 'youtube', 'pdf')),
  url TEXT NOT NULL,
  label TEXT,
  config_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets_index (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  alt_text TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  location TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'training')),
  image_r2_key TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  repeat_rule TEXT CHECK (repeat_rule IN ('weekly', 'biweekly', 'monthly', 'custom')),
  repeat_interval_days INTEGER,
  repeat_until TEXT,
  registration_enabled INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER,
  capacity_scope TEXT NOT NULL DEFAULT 'occurrence' CHECK (capacity_scope IN ('occurrence', 'series')),
  registration_cutoff_hours INTEGER DEFAULT 0,
  cancelled_at TEXT,
  cancellation_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_occurrence_cancellations (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  cancelled_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancellation_message TEXT,
  guests_notified INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, occurrence_date)
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  organization TEXT,
  spot_count INTEGER NOT NULL DEFAULT 1 CHECK (spot_count >= 1),
  notes TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, occurrence_date, guest_email)
);

CREATE INDEX IF NOT EXISTS idx_members_type ON members (type, company_name);
CREATE INDEX IF NOT EXISTS idx_archive_date ON archive_items (date DESC);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_registrations_event_occurrence ON event_registrations (event_id, occurrence_date);
CREATE INDEX IF NOT EXISTS idx_qa_sort ON qa_items (published, sort_order);
