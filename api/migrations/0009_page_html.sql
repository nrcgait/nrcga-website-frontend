-- Rich HTML page bodies + optional shell regions (e.g. home hero/contact)
ALTER TABLE pages ADD COLUMN body_html TEXT;
ALTER TABLE pages ADD COLUMN regions_json TEXT;
