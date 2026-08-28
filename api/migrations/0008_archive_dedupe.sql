-- Remove duplicate archive_items that share the same link.
-- Keep one row per link: prefer historical-document, then earliest date, then earliest created_at.

DELETE FROM archive_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY link
        ORDER BY
          CASE WHEN type = 'historical-document' THEN 0 ELSE 1 END,
          date ASC,
          created_at ASC,
          title ASC
      ) AS rn
    FROM archive_items
    WHERE link IS NOT NULL AND TRIM(link) != ''
  ) ranked
  WHERE rn > 1
);

-- Known bad duplicate titles (in case link-based dedupe already kept a wrong row)
DELETE FROM archive_items WHERE title = 'NRCGA News - March 26, 2027';
DELETE FROM archive_items WHERE title = 'NRCGA News - May 29, 2026';
DELETE FROM archive_items WHERE title = 'NRCGA News - May 25, 2025' AND type = 'meeting-minute';
