UPDATE public.mdr_drawings
SET rev = 'A', doc_no = doc_base || '-A'
WHERE rev = '0' OR rev IS NULL;

UPDATE public.mdr_drawing_revisions
SET rev = 'A', doc_no = doc_base || '-A'
WHERE rev = '0' OR rev IS NULL;