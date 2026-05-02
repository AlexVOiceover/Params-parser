-- ============================================================
-- Migration: add Client Param Sets layer
-- ============================================================
-- Hierarchy becomes Family → Variant → ClientSet → ParamVersion.
-- Backfills one "Default" client set per existing variant so all
-- existing param_versions are preserved.

BEGIN;

-- ── Drop policies that reference param_versions.param_set_id ──
-- (recreated at the end against client_set_id)

DROP POLICY IF EXISTS "param_versions_select_all"          ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_insert_contributor"  ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_update_admin"        ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_delete_admin"        ON public.param_versions;
DROP POLICY IF EXISTS "param_values_select"                ON public.param_values;


-- ── client_sets table ────────────────────────────────────────

CREATE TABLE public.client_sets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid        NOT NULL REFERENCES public.variants(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, name)
);

CREATE INDEX idx_client_sets_variant ON public.client_sets (variant_id);

ALTER TABLE public.client_sets ENABLE ROW LEVEL SECURITY;


-- ── Re-parent param_versions ─────────────────────────────────

ALTER TABLE public.param_versions
  ADD COLUMN client_set_id uuid REFERENCES public.client_sets(id) ON DELETE CASCADE;

-- Backfill: one "Default" client set per variant that has versions,
-- and rewrite each param_version's parent pointer.
WITH new_sets AS (
  INSERT INTO public.client_sets (variant_id, name, created_by, created_at, updated_at)
  SELECT DISTINCT
    v.id,
    'Default',
    v.created_by,
    v.created_at,
    v.updated_at
  FROM public.variants v
  WHERE EXISTS (
    SELECT 1 FROM public.param_versions pv WHERE pv.param_set_id = v.id
  )
  RETURNING id, variant_id
)
UPDATE public.param_versions pv
SET client_set_id = ns.id
FROM new_sets ns
WHERE pv.param_set_id = ns.variant_id;

-- Sanity: every existing param_version must now have a client_set_id.
-- If any rows are unmatched (orphans), fail the migration loudly.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM public.param_versions WHERE client_set_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Backfill missed % param_versions rows', orphan_count;
  END IF;
END $$;

ALTER TABLE public.param_versions
  ALTER COLUMN client_set_id SET NOT NULL;

-- Drop the old (param_set_id, version_label) unique constraint.
-- Constraint name was auto-generated, so look it up dynamically.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.param_versions'::regclass
    AND contype = 'u'
    AND conkey @> (
      SELECT array_agg(attnum)
      FROM pg_attribute
      WHERE attrelid = 'public.param_versions'::regclass
        AND attname IN ('param_set_id', 'version_label')
    );
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.param_versions DROP CONSTRAINT %I', cname);
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_param_versions_param_set;
DROP INDEX IF EXISTS public.idx_param_versions_latest;

ALTER TABLE public.param_versions DROP COLUMN param_set_id;

ALTER TABLE public.param_versions
  ADD CONSTRAINT param_versions_client_set_version_label_key
  UNIQUE (client_set_id, version_label);

CREATE INDEX idx_param_versions_client_set ON public.param_versions (client_set_id);
CREATE INDEX idx_param_versions_latest    ON public.param_versions (client_set_id, is_latest);


-- ── RLS policies ─────────────────────────────────────────────

-- client_sets: public read, contributor insert, owner-or-admin update, admin delete
CREATE POLICY "client_sets_select_all"
  ON public.client_sets FOR SELECT
  USING (true);

CREATE POLICY "client_sets_insert_contributor"
  ON public.client_sets FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "client_sets_update_owner"
  ON public.client_sets FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "client_sets_delete_admin"
  ON public.client_sets FOR DELETE
  USING (public.is_admin());


-- param_versions: visibility joins through client_sets → variants
CREATE POLICY "param_versions_select_all"
  ON public.param_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_sets cs
      JOIN public.variants v ON v.id = cs.variant_id
      WHERE cs.id = client_set_id
    )
  );

CREATE POLICY "param_versions_insert_contributor"
  ON public.param_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_sets cs
      JOIN public.variants v ON v.id = cs.variant_id
      WHERE cs.id = client_set_id
        AND (cs.created_by = auth.uid() OR v.created_by = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "param_versions_update_admin"
  ON public.param_versions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "param_versions_delete_admin"
  ON public.param_versions FOR DELETE
  USING (public.is_admin());


-- param_values: visibility joins through param_versions → client_sets
CREATE POLICY "param_values_select"
  ON public.param_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.param_versions pv
      JOIN public.client_sets cs ON cs.id = pv.client_set_id
      WHERE pv.id = param_version_id
    )
  );

COMMIT;
