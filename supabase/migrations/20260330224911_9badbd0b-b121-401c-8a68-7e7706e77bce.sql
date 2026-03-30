
-- Drop old unique constraint (mpp_uid, wbs_full)
ALTER TABLE public.cpm_activities DROP CONSTRAINT IF EXISTS cpm_activities_mpp_uid_wbs_full_key;

-- Add new unique constraint on mpp_uid only
ALTER TABLE public.cpm_activities ADD CONSTRAINT cpm_activities_mpp_uid_key UNIQUE (mpp_uid);
