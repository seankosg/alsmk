ALTER TABLE public.mdr_drawings RENAME COLUMN job_no TO plant_id;
ALTER TABLE public.mdr_drawings RENAME COLUMN area_code TO pbs;
ALTER TABLE public.mdr_drawings RENAME COLUMN function_code TO fbs;
ALTER TABLE public.mdr_drawings RENAME COLUMN serial_no TO ser_no;