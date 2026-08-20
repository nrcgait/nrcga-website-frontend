-- Repair duplicate chair/vice-chair flags from prefix LIKE matching in the original 0012 migration.
-- Keep a single holder for each officer position (lowest id wins).

UPDATE members
SET is_chair = 0
WHERE type = 'Stakeholder'
  AND is_chair = 1
  AND id NOT IN (
    SELECT id FROM (
      SELECT id FROM members
      WHERE type = 'Stakeholder' AND is_chair = 1
      ORDER BY id
      LIMIT 1
    )
  );

UPDATE members
SET is_vice_chair = 0
WHERE type = 'Stakeholder'
  AND is_vice_chair = 1
  AND id NOT IN (
    SELECT id FROM (
      SELECT id FROM members
      WHERE type = 'Stakeholder' AND is_vice_chair = 1
      ORDER BY id
      LIMIT 1
    )
  );
