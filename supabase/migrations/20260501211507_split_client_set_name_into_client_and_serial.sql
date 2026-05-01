-- ============================================================
-- Migration: split client_sets.name into client_name + serial
-- ============================================================
-- Each row of client_sets now identifies a real drone:
--   client_name (e.g. "Acme Corp") + serial (e.g. "SN-12345")
-- The unique constraint becomes (variant_id, client_name, serial).
-- Legacy "Default" rows (from the Phase 2 backfill) keep
-- client_name="Default" and serial="".

BEGIN;

ALTER TABLE public.client_sets
  ADD COLUMN client_name text,
  ADD COLUMN serial      text;

-- Backfill: copy existing name into client_name; default serial to ""
UPDATE public.client_sets SET client_name = name, serial = '' WHERE client_name IS NULL;

ALTER TABLE public.client_sets
  ALTER COLUMN client_name SET NOT NULL,
  ALTER COLUMN serial      SET NOT NULL;

-- Drop the old (variant_id, name) unique constraint
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.client_sets'::regclass
    AND contype = 'u'
    AND conkey @> (
      SELECT array_agg(attnum)
      FROM pg_attribute
      WHERE attrelid = 'public.client_sets'::regclass
        AND attname IN ('variant_id', 'name')
    );
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.client_sets DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.client_sets DROP COLUMN name;

-- New uniqueness: a (client_name, serial) pair is unique within a variant
ALTER TABLE public.client_sets
  ADD CONSTRAINT client_sets_variant_client_serial_key
  UNIQUE (variant_id, client_name, serial);

COMMIT;
