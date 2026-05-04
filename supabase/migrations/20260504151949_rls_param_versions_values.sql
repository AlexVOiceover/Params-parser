-- Tighten RLS on param_versions and param_values so visibility piggybacks on
-- client_sets visibility. Inline the client_sets predicate (rather than
-- relying on EXISTS over client_sets) because RLS doesn't recurse through
-- referenced tables — the policy must restate the rule explicitly.

DROP POLICY IF EXISTS "param_versions_select_all"           ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_insert_contributor"   ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_update_admin"         ON public.param_versions;
DROP POLICY IF EXISTS "param_versions_delete_admin"         ON public.param_versions;

CREATE POLICY "param_versions_select"
  ON public.param_versions FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_sets cs
      WHERE cs.id = client_set_id
        AND (
          cs.client_id = public.current_client_id()
          OR (
            cs.is_default
            AND EXISTS (
              SELECT 1 FROM public.client_sets owned
              WHERE owned.variant_id = cs.variant_id
                AND owned.client_id = public.current_client_id()
            )
          )
        )
    )
  );

CREATE POLICY "param_versions_insert"
  ON public.param_versions FOR INSERT
  WITH CHECK (
    public.is_contributor_or_admin()
    OR (
      public.current_role() = 'client'
      AND EXISTS (
        SELECT 1 FROM public.client_sets cs
        WHERE cs.id = client_set_id
          AND cs.client_id = public.current_client_id()
          AND cs.is_default = false
      )
    )
  );

CREATE POLICY "param_versions_update"
  ON public.param_versions FOR UPDATE
  USING (public.is_contributor_or_admin())
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "param_versions_delete"
  ON public.param_versions FOR DELETE
  USING (public.is_admin());


-- ── param_values ─────────────────────────────────────────────

DROP POLICY IF EXISTS "param_values_select"  ON public.param_values;
DROP POLICY IF EXISTS "param_values_insert"  ON public.param_values;
DROP POLICY IF EXISTS "param_values_update"  ON public.param_values;
DROP POLICY IF EXISTS "param_values_delete"  ON public.param_values;

-- param_values inherits visibility from its parent param_version.
-- Inline the same predicate (RLS doesn't recurse).
CREATE POLICY "param_values_select"
  ON public.param_values FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR EXISTS (
      SELECT 1
      FROM public.param_versions pv
      JOIN public.client_sets cs ON cs.id = pv.client_set_id
      WHERE pv.id = param_version_id
        AND (
          cs.client_id = public.current_client_id()
          OR (
            cs.is_default
            AND EXISTS (
              SELECT 1 FROM public.client_sets owned
              WHERE owned.variant_id = cs.variant_id
                AND owned.client_id = public.current_client_id()
            )
          )
        )
    )
  );

CREATE POLICY "param_values_insert"
  ON public.param_values FOR INSERT
  WITH CHECK (
    public.is_contributor_or_admin()
    OR (
      public.current_role() = 'client'
      AND EXISTS (
        SELECT 1
        FROM public.param_versions pv
        JOIN public.client_sets cs ON cs.id = pv.client_set_id
        WHERE pv.id = param_version_id
          AND cs.client_id = public.current_client_id()
          AND cs.is_default = false
      )
    )
  );

CREATE POLICY "param_values_update"
  ON public.param_values FOR UPDATE
  USING (public.is_contributor_or_admin())
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "param_values_delete"
  ON public.param_values FOR DELETE
  USING (public.is_admin());
