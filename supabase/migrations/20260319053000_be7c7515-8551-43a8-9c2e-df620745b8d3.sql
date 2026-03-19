-- Group existing recurring events by title + created_by (same title = same recurrence group)
WITH groups AS (
  SELECT title, created_by, gen_random_uuid() AS group_id
  FROM calendar_events
  WHERE recurrence_group_id IS NULL
  GROUP BY title, created_by
  HAVING count(*) > 1
)
UPDATE calendar_events ce
SET recurrence_group_id = g.group_id
FROM groups g
WHERE ce.title = g.title
  AND ce.created_by = g.created_by
  AND ce.recurrence_group_id IS NULL;