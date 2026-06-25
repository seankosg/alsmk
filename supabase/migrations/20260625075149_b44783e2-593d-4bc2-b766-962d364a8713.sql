
WITH bad AS (
  SELECT drawing_id, stage
  FROM mdr_milestone_cells
  GROUP BY drawing_id, stage
  HAVING SUM(increment_pct) > 100
)
DELETE FROM mdr_milestone_cells c
USING bad
WHERE c.drawing_id = bad.drawing_id
  AND c.stage = bad.stage
  AND c.pct = 100
  AND c.sub_idx >= 1;
