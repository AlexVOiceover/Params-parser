-- ============================================================
-- Migration 005: param_values — individual param rows per version
-- ============================================================
-- Stores each NAME,VALUE pair from every uploaded .param file.
-- Enables analytics: track a parameter's value across versions.
-- The raw file is still stored in Supabase Storage (source of truth).

CREATE TABLE public.param_values (
  param_version_id  uuid  NOT NULL REFERENCES public.param_versions(id) ON DELETE CASCADE,
  name              text  NOT NULL,
  value             text  NOT NULL,
  PRIMARY KEY (param_version_id, name)
);

-- Enables fast lookup of a single param across all versions
CREATE INDEX idx_param_values_name ON public.param_values (name);

ALTER TABLE public.param_values ENABLE ROW LEVEL SECURITY;

-- Read access mirrors parent param_set visibility
CREATE POLICY "param_values_select"
  ON public.param_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.param_versions pv
      JOIN public.param_sets ps ON ps.id = pv.param_set_id
      WHERE pv.id = param_version_id
        AND (ps.published = true OR ps.created_by = auth.uid() OR public.is_admin())
    )
  );

-- Writes are performed exclusively via the service-role upload route.
-- No client-facing INSERT/UPDATE/DELETE policies are needed.
