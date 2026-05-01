-- ============================================================
-- Migration: rename drone_types→families, param_sets→variants
-- ============================================================
-- Phase 1 of the Families/Variants/ClientSets restructure.
-- Renames only — no schema reshape, no data backfill.
-- param_versions.param_set_id stays as-is; renamed in Phase 2.

BEGIN;

-- ── Drop policies that reference the tables being renamed ────
-- (drone_types_*, param_sets_*, and the param_versions/param_values
--  policies that join through param_sets — must be recreated against
--  the renamed tables to keep their predicates valid.)

DROP POLICY IF EXISTS "drone_types_select_all"          ON public.drone_types;
DROP POLICY IF EXISTS "drone_types_write_admin"         ON public.drone_types;

DROP POLICY IF EXISTS "param_sets_select_all"           ON public.param_sets;
DROP POLICY IF EXISTS "param_sets_insert_contributor"   ON public.param_sets;
DROP POLICY IF EXISTS "param_sets_update_owner"         ON public.param_sets;
DROP POLICY IF EXISTS "param_sets_delete_admin"         ON public.param_sets;

DROP POLICY IF EXISTS "param_versions_select_all"       ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_insert_contributor" ON public.param_versions;

DROP POLICY IF EXISTS "param_values_select"             ON public.param_values;


-- ── Rename tables ────────────────────────────────────────────
ALTER TABLE public.drone_types RENAME TO families;
ALTER TABLE public.param_sets  RENAME TO variants;


-- ── Rename FK columns ────────────────────────────────────────
ALTER TABLE public.variants RENAME COLUMN drone_type_id TO family_id;


-- ── Rename indexes ───────────────────────────────────────────
ALTER INDEX IF EXISTS public.idx_param_sets_drone_type RENAME TO idx_variants_family;
ALTER INDEX IF EXISTS public.idx_param_sets_created_by RENAME TO idx_variants_created_by;


-- ── Recreate policies under the new table names ──────────────

-- families: public read, admin write
CREATE POLICY "families_select_all"
  ON public.families FOR SELECT
  USING (true);

CREATE POLICY "families_write_admin"
  ON public.families FOR ALL
  USING (public.is_admin());


-- variants: public read, contributor insert, owner/admin update, admin delete
CREATE POLICY "variants_select_all"
  ON public.variants FOR SELECT
  USING (true);

CREATE POLICY "variants_insert_contributor"
  ON public.variants FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "variants_update_owner"
  ON public.variants FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "variants_delete_admin"
  ON public.variants FOR DELETE
  USING (public.is_admin());


-- param_versions: parent visibility now joins through variants
CREATE POLICY "param_versions_select_all"
  ON public.param_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.variants v
      WHERE v.id = param_set_id
    )
  );

CREATE POLICY "param_versions_insert_contributor"
  ON public.param_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.variants v
      WHERE v.id = param_set_id
        AND (v.created_by = auth.uid() OR public.is_admin())
    )
  );


-- param_values: parent visibility now joins through variants
CREATE POLICY "param_values_select"
  ON public.param_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.param_versions pv
      JOIN public.variants v ON v.id = pv.param_set_id
      WHERE pv.id = param_version_id
    )
  );

COMMIT;
