-- Step 1: Relink cpm_task_mappings to the surviving (earliest) activity per (mpp_task_id, wbs_full)
WITH survivors AS (
  SELECT DISTINCT ON (COALESCE(mpp_task_id, ''), COALESCE(wbs_full, ''))
    id,
    COALESCE(mpp_task_id, '') AS key1,
    COALESCE(wbs_full, '') AS key2
  FROM public.cpm_activities
  ORDER BY COALESCE(mpp_task_id, ''), COALESCE(wbs_full, ''), created_at ASC
),
mapping_updates AS (
  SELECT tm.id AS mapping_id, s.id AS new_activity_id
  FROM public.cpm_task_mappings tm
  JOIN public.cpm_activities ca ON ca.id = tm.activity_id
  JOIN survivors s ON s.key1 = COALESCE(ca.mpp_task_id, '') AND s.key2 = COALESCE(ca.wbs_full, '')
  WHERE tm.activity_id != s.id
)
UPDATE public.cpm_task_mappings tm
SET activity_id = mu.new_activity_id
FROM mapping_updates mu
WHERE tm.id = mu.mapping_id;

-- Step 2: Remove duplicate mappings that now point to same (activity_id, task_id)
DELETE FROM public.cpm_task_mappings
WHERE id NOT IN (
  SELECT DISTINCT ON (activity_id, task_id) id
  FROM public.cpm_task_mappings
  ORDER BY activity_id, task_id, created_at ASC
);

-- Step 3: Delete duplicate cpm_activities, keeping earliest per (mpp_task_id, wbs_full)
DELETE FROM public.cpm_activities
WHERE id NOT IN (
  SELECT DISTINCT ON (COALESCE(mpp_task_id, ''), COALESCE(wbs_full, ''))
    id
  FROM public.cpm_activities
  ORDER BY COALESCE(mpp_task_id, ''), COALESCE(wbs_full, ''), created_at ASC
);

-- Step 4: Add unique constraint to prevent future duplicates
ALTER TABLE public.cpm_activities
ADD CONSTRAINT cpm_activities_mpp_task_id_wbs_full_key UNIQUE (mpp_task_id, wbs_full);