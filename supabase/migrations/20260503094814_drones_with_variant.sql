-- ============================================================
-- Migration: drones gain a required variant_id
-- ============================================================
-- A drone is now identified by (client, variant, serial) — i.e. a
-- physical airframe registered to a customer for a specific variant.
-- This lets the upload flow show "<serial> — <family> / <variant>"
-- as a single Serial dropdown that fully resolves the upload target.

BEGIN;

ALTER TABLE public.drones
  ADD COLUMN variant_id uuid REFERENCES public.variants(id) ON DELETE RESTRICT;

-- Backfill: each existing drone's variant comes from its client_sets.
-- We assume one variant per drone (verified before this migration).
-- If a drone has no client_set or multiple variants, fail loudly.
UPDATE public.drones d
SET variant_id = (
  SELECT cs.variant_id
  FROM public.client_sets cs
  WHERE cs.drone_id = d.id
  GROUP BY cs.variant_id
  ORDER BY count(*) DESC
  LIMIT 1
)
WHERE d.variant_id IS NULL;

DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM public.drones WHERE variant_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot backfill drones.variant_id for % drones without client_sets. Register them manually first.', orphan_count;
  END IF;
END $$;

ALTER TABLE public.drones
  ALTER COLUMN variant_id SET NOT NULL;

CREATE INDEX idx_drones_variant ON public.drones (variant_id);

-- Uniqueness rule: a serial is unique per client across all variants.
-- (Existing UNIQUE (client_id, serial) constraint stays as-is.)

COMMIT;
