-- Tighten RLS on client_sets so a `client`-role user only sees their own
-- company's sets, plus the per-variant Default for variants where they
-- have at least one set (so they have something to compare against).
-- Clients can also insert sets under their own client_id / drone_id, but
-- never the Default.

DROP POLICY IF EXISTS "client_sets_select_all"          ON public.client_sets;
DROP POLICY IF EXISTS "client_sets_insert_contributor"  ON public.client_sets;
DROP POLICY IF EXISTS "client_sets_update_owner"        ON public.client_sets;
DROP POLICY IF EXISTS "client_sets_delete_admin"        ON public.client_sets;

CREATE POLICY "client_sets_select"
  ON public.client_sets FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR client_id = public.current_client_id()
    OR (
      is_default
      AND EXISTS (
        SELECT 1 FROM public.client_sets cs
        WHERE cs.variant_id = client_sets.variant_id
          AND cs.client_id = public.current_client_id()
      )
    )
  );

CREATE POLICY "client_sets_insert"
  ON public.client_sets FOR INSERT
  WITH CHECK (
    public.is_contributor_or_admin()
    OR (
      public.current_role() = 'client'
      AND client_id = public.current_client_id()
      AND is_default = false
      AND EXISTS (
        SELECT 1 FROM public.drones d
        WHERE d.id = drone_id
          AND d.client_id = public.current_client_id()
      )
    )
  );

CREATE POLICY "client_sets_update"
  ON public.client_sets FOR UPDATE
  USING (public.is_contributor_or_admin())
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "client_sets_delete"
  ON public.client_sets FOR DELETE
  USING (public.is_admin());
