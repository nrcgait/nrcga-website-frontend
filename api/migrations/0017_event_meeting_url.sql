-- Optional virtual join link for calendar events (Zoom, Teams, Meet, etc.)
ALTER TABLE events ADD COLUMN meeting_url TEXT;
