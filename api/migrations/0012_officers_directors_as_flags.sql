-- Officers and directors are attributes of stakeholder members, not separate types.
-- Merge legacy Officer/Director rows onto matching stakeholders, then remove those types.

-- Chair: copy flag + term onto stakeholder whose company matches the officer's org (contact_person)
UPDATE members
SET
  is_chair = 1,
  term = COALESCE(
    NULLIF(TRIM(COALESCE(term, '')), ''),
    (
      SELECT o.term
      FROM members o
      WHERE o.type = 'Officer'
        AND (o.is_chair = 1 OR o.stakeholder_group = 'Chair')
        AND LOWER(TRIM(o.contact_person)) = LOWER(TRIM(members.company_name))
      LIMIT 1
    )
  )
WHERE type = 'Stakeholder'
  AND EXISTS (
    SELECT 1
    FROM members o
    WHERE o.type = 'Officer'
      AND (o.is_chair = 1 OR o.stakeholder_group = 'Chair')
      AND (
        LOWER(TRIM(o.contact_person)) = LOWER(TRIM(members.company_name))
        OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(o.contact_person)) || '%'
        OR LOWER(TRIM(o.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
      )
  );

-- Vice Chair
UPDATE members
SET
  is_vice_chair = 1,
  term = COALESCE(
    NULLIF(TRIM(COALESCE(term, '')), ''),
    (
      SELECT o.term
      FROM members o
      WHERE o.type = 'Officer'
        AND (o.is_vice_chair = 1 OR o.stakeholder_group = 'Vice Chair')
        AND (
          LOWER(TRIM(o.contact_person)) = LOWER(TRIM(members.company_name))
          OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(o.contact_person)) || '%'
          OR LOWER(TRIM(o.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
        )
      LIMIT 1
    )
  )
WHERE type = 'Stakeholder'
  AND EXISTS (
    SELECT 1
    FROM members o
    WHERE o.type = 'Officer'
      AND (o.is_vice_chair = 1 OR o.stakeholder_group = 'Vice Chair')
      AND (
        LOWER(TRIM(o.contact_person)) = LOWER(TRIM(members.company_name))
        OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(o.contact_person)) || '%'
        OR LOWER(TRIM(o.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
      )
  );

-- Directors: mark matching stakeholders as board members (org is contact_person on Director rows)
UPDATE members
SET
  is_board_member = 1,
  term = COALESCE(
    NULLIF(TRIM(COALESCE(term, '')), ''),
    (
      SELECT d.term
      FROM members d
      WHERE d.type = 'Director'
        AND (
          LOWER(TRIM(d.contact_person)) = LOWER(TRIM(members.company_name))
          OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(d.contact_person)) || '%'
          OR LOWER(TRIM(d.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
        )
      LIMIT 1
    )
  ),
  contact_person = COALESCE(
    NULLIF(TRIM(COALESCE(contact_person, '')), ''),
    (
      SELECT d.company_name
      FROM members d
      WHERE d.type = 'Director'
        AND (
          LOWER(TRIM(d.contact_person)) = LOWER(TRIM(members.company_name))
          OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(d.contact_person)) || '%'
          OR LOWER(TRIM(d.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
        )
      LIMIT 1
    )
  )
WHERE type = 'Stakeholder'
  AND EXISTS (
    SELECT 1
    FROM members d
    WHERE d.type = 'Director'
      AND (
        LOWER(TRIM(d.contact_person)) = LOWER(TRIM(members.company_name))
        OR LOWER(TRIM(members.company_name)) LIKE LOWER(TRIM(d.contact_person)) || '%'
        OR LOWER(TRIM(d.contact_person)) LIKE LOWER(TRIM(members.company_name)) || '%'
      )
  );

-- Unmatched Directors → stakeholder with swapped person/org fields
UPDATE members
SET
  type = 'Stakeholder',
  is_board_member = 1,
  company_name = contact_person,
  contact_person = company_name,
  category = COALESCE(NULLIF(TRIM(COALESCE(category, '')), ''), stakeholder_group)
WHERE type = 'Director'
  AND NOT EXISTS (
    SELECT 1
    FROM members s
    WHERE s.type = 'Stakeholder'
      AND s.id != members.id
      AND (
        LOWER(TRIM(s.company_name)) = LOWER(TRIM(members.contact_person))
        OR LOWER(TRIM(s.company_name)) LIKE LOWER(TRIM(members.contact_person)) || '%'
        OR LOWER(TRIM(members.contact_person)) LIKE LOWER(TRIM(s.company_name)) || '%'
      )
  );

-- Unmatched Officers → stakeholder with swapped person/org; clear Chair/Vice Chair as group
UPDATE members
SET
  type = 'Stakeholder',
  is_chair = CASE WHEN is_chair = 1 OR stakeholder_group = 'Chair' THEN 1 ELSE is_chair END,
  is_vice_chair = CASE WHEN is_vice_chair = 1 OR stakeholder_group = 'Vice Chair' THEN 1 ELSE is_vice_chair END,
  company_name = contact_person,
  contact_person = company_name,
  stakeholder_group = NULL,
  category = NULL
WHERE type = 'Officer'
  AND NOT EXISTS (
    SELECT 1
    FROM members s
    WHERE s.type = 'Stakeholder'
      AND s.id != members.id
      AND (
        LOWER(TRIM(s.company_name)) = LOWER(TRIM(members.contact_person))
        OR LOWER(TRIM(s.company_name)) LIKE LOWER(TRIM(members.contact_person)) || '%'
        OR LOWER(TRIM(members.contact_person)) LIKE LOWER(TRIM(s.company_name)) || '%'
      )
  );

-- Drop remaining dedicated Officer/Director type rows (flags already merged)
DELETE FROM members WHERE type IN ('Officer', 'Director');
