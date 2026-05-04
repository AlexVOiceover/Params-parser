-- Tighten RLS on clients and drones so a `client`-role user only sees
-- their own company and their own drones. Admin/contributor still see all.

-- ── clients ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "clients_select_all"          ON public.clients;
DROP POLICY IF EXISTS "clients_insert_contributor"  ON public.clients;
DROP POLICY IF EXISTS "clients_update_contributor"  ON public.clients;
DROP POLICY IF EXISTS "clients_delete_admin"        ON public.clients;

CREATE POLICY "clients_select"
  ON public.clients FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR id = public.current_client_id()
  );

CREATE POLICY "clients_insert"
  ON public.clients FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "clients_update"
  ON public.clients FOR UPDATE
  USING (public.is_contributor_or_admin())
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "clients_delete"
  ON public.clients FOR DELETE
  USING (public.is_admin());


-- ── drones ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "drones_select_all"          ON public.drones;
DROP POLICY IF EXISTS "drones_insert_contributor"  ON public.drones;
DROP POLICY IF EXISTS "drones_update_contributor"  ON public.drones;
DROP POLICY IF EXISTS "drones_delete_admin"        ON public.drones;

CREATE POLICY "drones_select"
  ON public.drones FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR client_id = public.current_client_id()
  );

CREATE POLICY "drones_insert"
  ON public.drones FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "drones_update"
  ON public.drones FOR UPDATE
  USING (public.is_contributor_or_admin())
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "drones_delete"
  ON public.drones FOR DELETE
  USING (public.is_admin());
