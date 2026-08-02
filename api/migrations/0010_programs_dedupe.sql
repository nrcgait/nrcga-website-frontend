-- Remove duplicate programs that share the same link.
-- Keep one row per link: earliest created_at, then lowest sort_order, then id.

DELETE FROM programs
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY link
        ORDER BY
          created_at ASC,
          sort_order ASC,
          id ASC
      ) AS rn
    FROM programs
    WHERE link IS NOT NULL AND TRIM(link) != ''
  ) ranked
  WHERE rn > 1
);
