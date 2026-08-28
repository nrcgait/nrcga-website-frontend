-- Repair CTA-only body_html stubs created when migration 0013 ran against NULL body_html.
UPDATE pages
SET body_html = NULL
WHERE body_json IS NOT NULL
  AND trim(body_json) != ''
  AND trim(body_json) != '[]'
  AND body_html IS NOT NULL
  AND body_html LIKE '%committee-enrollment.html%'
  AND body_html LIKE '%Get Involved%'
  AND length(body_html) < 1500;

-- Drop truncated About body_html so renderPageBody can prefer full body_json.
UPDATE pages
SET body_html = NULL
WHERE slug = 'about'
  AND body_json IS NOT NULL
  AND trim(body_json) != '[]'
  AND (
    body_html IS NULL
    OR body_html NOT LIKE '%What We Do%'
  );
