-- Chair / Vice Chair officer flags (one holder per position)

ALTER TABLE members ADD COLUMN is_chair INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN is_vice_chair INTEGER NOT NULL DEFAULT 0;

UPDATE members SET is_chair = 1 WHERE type = 'Officer' AND stakeholder_group = 'Chair';
UPDATE members SET is_vice_chair = 1 WHERE type = 'Officer' AND stakeholder_group = 'Vice Chair';
