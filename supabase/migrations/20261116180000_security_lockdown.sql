-- Security lockdown (audit 2026-11-16).
--
-- Every write in the app goes through an API route that checks the caller and
-- then writes with the service role. Direct PostgREST writes from a browser
-- session are therefore only ever an attack path, so only admins keep them.
-- Reads stay scoped as before; families/variants stop being world-readable.
--
-- The live policy names drifted across migrations, so each table's policies
-- are dropped by catalogue lookup and recreated from scratch here.

BEGIN;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('families', 'variants', 'clients', 'drones', 'client_sets',
                        'param_versions', 'param_values', 'drone_events')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.client_owns_set_in_family(target_family uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_sets cs
    JOIN public.variants v ON v.id = cs.variant_id
    WHERE v.family_id = target_family
      AND cs.client_id = public.current_client_id()
  );
$$;

-- ── Reads ────────────────────────────────────────────────────

CREATE POLICY "families_select" ON public.families FOR SELECT TO authenticated
  USING (public.is_contributor_or_admin() OR public.client_owns_set_in_family(id));

CREATE POLICY "variants_select" ON public.variants FOR SELECT TO authenticated
  USING (public.is_contributor_or_admin() OR public.client_owns_set_in_variant(id));

CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated
  USING (public.is_contributor_or_admin() OR id = public.current_client_id());

CREATE POLICY "drones_select" ON public.drones FOR SELECT TO authenticated
  USING (public.is_contributor_or_admin() OR client_id = public.current_client_id());

CREATE POLICY "client_sets_select" ON public.client_sets FOR SELECT TO authenticated
  USING (
    public.is_contributor_or_admin()
    OR client_id = public.current_client_id()
    OR (is_default AND public.client_owns_set_in_variant(variant_id))
  );

CREATE POLICY "param_versions_select" ON public.param_versions FOR SELECT TO authenticated
  USING (
    public.is_contributor_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_sets cs
      WHERE cs.id = client_set_id
        AND (cs.client_id = public.current_client_id()
             OR (cs.is_default AND public.client_owns_set_in_variant(cs.variant_id)))
    )
  );

CREATE POLICY "param_values_select" ON public.param_values FOR SELECT TO authenticated
  USING (
    public.is_contributor_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.param_versions pv
      JOIN public.client_sets cs ON cs.id = pv.client_set_id
      WHERE pv.id = param_version_id
        AND (cs.client_id = public.current_client_id()
             OR (cs.is_default AND public.client_owns_set_in_variant(cs.variant_id)))
    )
  );

CREATE POLICY "drone_events_select" ON public.drone_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drones d WHERE d.id = drone_id));

-- ── Writes: admin only (routes use the service role) ─────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['families', 'variants', 'clients', 'drones', 'client_sets',
                           'param_versions', 'param_values']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t || '_delete', t);
  END LOOP;
END $$;

-- The drone log is written only by server routes after verifying a read-back.
-- No INSERT/UPDATE/DELETE policy: nobody can write it through the API.

-- New versions wait for review unless a route explicitly approves them.
ALTER TABLE public.param_versions ALTER COLUMN needs_review SET DEFAULT true;

-- Stored files are served through an authenticated route, never by public URL.
UPDATE storage.buckets SET public = false WHERE id = 'param-files';

COMMIT;
