-- ============================================================
-- Migration: Remove published column from param_sets
-- ============================================================

-- Drop all policies that reference published
DROP POLICY IF EXISTS "param_sets_select_published" ON public.param_sets;
DROP POLICY IF EXISTS "param_versions_select_all" ON public.param_versions;
DROP POLICY IF EXISTS "param_values_select" ON public.param_values;

-- New policy: param_sets are visible to everyone
CREATE POLICY "param_sets_select_all"
  ON public.param_sets FOR SELECT
  USING (true);

-- New policy: param_versions are visible if the parent param_set is visible
CREATE POLICY "param_versions_select_all"
  ON public.param_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.param_sets ps
      WHERE ps.id = param_set_id
    )
  );

-- New policy: param_values are visible if the parent param_set is visible
CREATE POLICY "param_values_select"
  ON public.param_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.param_versions pv
      JOIN public.param_sets ps ON ps.id = pv.param_set_id
      WHERE pv.id = param_version_id
    )
  );

-- Drop index and column
DROP INDEX IF EXISTS public.idx_param_sets_published;
ALTER TABLE public.param_sets DROP COLUMN IF EXISTS published;
