-- Convert version_label from 'N.0' strings to plain integers.
-- Existing labels like '1.0', '2.0' become '1', '2'.
-- After backfill, add a CHECK constraint so the DB rejects decimal labels.

UPDATE public.param_versions
   SET version_label = split_part(version_label, '.', 1)
 WHERE version_label LIKE '%.%';

ALTER TABLE public.param_versions
  ADD CONSTRAINT param_versions_version_label_integer
  CHECK (version_label ~ '^\d+$');
