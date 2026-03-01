-- ============================================================
-- Migration 002: Row Level Security policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drone_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmwares         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.param_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.param_versions    ENABLE ROW LEVEL SECURITY;


-- ── Helper: is the current user an admin? ────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS bool
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_contributor_or_admin()
RETURNS bool
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('contributor', 'admin')
  );
$$;


-- ── profiles ─────────────────────────────────────────────────
-- Users see their own row; admins see all.
-- Users can update their own username; admins can update role.

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin());


-- ── protection_lists ─────────────────────────────────────────
-- Everyone reads global lists (owner_id IS NULL).
-- Authenticated users read their own lists.
-- Only admins write global lists; users write their own.

CREATE POLICY "lists_select_global"
  ON public.protection_lists FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "lists_insert_admin_global"
  ON public.protection_lists FOR INSERT
  WITH CHECK (
    (owner_id IS NULL AND public.is_admin()) OR
    (owner_id = auth.uid())
  );

CREATE POLICY "lists_update_admin_global"
  ON public.protection_lists FOR UPDATE
  USING (
    (owner_id IS NULL AND public.is_admin()) OR
    (owner_id = auth.uid())
  );

CREATE POLICY "lists_delete_admin_global"
  ON public.protection_lists FOR DELETE
  USING (
    (owner_id IS NULL AND public.is_admin()) OR
    (owner_id = auth.uid())
  );


-- ── drone_types ───────────────────────────────────────────────
-- Public read. Only admins write.

CREATE POLICY "drone_types_select_all"
  ON public.drone_types FOR SELECT
  USING (true);

CREATE POLICY "drone_types_write_admin"
  ON public.drone_types FOR ALL
  USING (public.is_admin());


-- ── firmwares ─────────────────────────────────────────────────
-- Public read. Only admins write.

CREATE POLICY "firmwares_select_all"
  ON public.firmwares FOR SELECT
  USING (true);

CREATE POLICY "firmwares_write_admin"
  ON public.firmwares FOR ALL
  USING (public.is_admin());


-- ── param_sets ────────────────────────────────────────────────
-- Published sets: everyone reads.
-- Unpublished sets: only creator and admins read.
-- Insert: contributors and admins.
-- Update: creator or admin.
-- Delete: admin only.

CREATE POLICY "param_sets_select_published"
  ON public.param_sets FOR SELECT
  USING (
    published = true OR
    created_by = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "param_sets_insert_contributor"
  ON public.param_sets FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "param_sets_update_owner"
  ON public.param_sets FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "param_sets_delete_admin"
  ON public.param_sets FOR DELETE
  USING (public.is_admin());


-- ── param_versions ────────────────────────────────────────────
-- Read: same as parent param_set (via join in queries; simplified here).
-- Insert: contributor for their own param_sets, or admin.
-- Update/Delete: admin only.

CREATE POLICY "param_versions_select_all"
  ON public.param_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.param_sets ps
      WHERE ps.id = param_set_id
        AND (ps.published = true OR ps.created_by = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "param_versions_insert_contributor"
  ON public.param_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.param_sets ps
      WHERE ps.id = param_set_id
        AND (ps.created_by = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "param_versions_update_admin"
  ON public.param_versions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "param_versions_delete_admin"
  ON public.param_versions FOR DELETE
  USING (public.is_admin());
