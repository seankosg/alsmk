UPDATE cpm_activities
SET semantic_key = CONCAT(
  COALESCE(custom_fields->>'BLDG', custom_fields->>'Text2', custom_fields->>'텍스트2', '_'),
  '::',
  CASE 
    WHEN wbs_full IS NOT NULL AND wbs_full LIKE '%.%' 
    THEN split_part(wbs_full, '.', 1) || '.' || split_part(wbs_full, '.', 2)
    ELSE COALESCE(split_part(wbs_full, '.', 1), '_')
  END,
  '::',
  name
)
WHERE semantic_key IS NULL;