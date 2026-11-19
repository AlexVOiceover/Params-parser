-- Rollback for 20261116180000_security_lockdown.sql.
-- The live policies, column default and bucket flag as they were on 2026-11-19, read just before the migration was applied.
-- Run by hand only if the lockdown has to be undone.

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

CREATE POLICY "client_sets_delete" ON public.client_sets AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "client_sets_insert" ON public.client_sets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_contributor_or_admin() OR (("current_role"() = 'client'::text) AND (client_id = current_client_id()) AND (is_default = false) AND (EXISTS ( SELECT 1
   FROM drones d
  WHERE ((d.id = client_sets.drone_id) AND (d.client_id = current_client_id())))))));

CREATE POLICY "client_sets_select" ON public.client_sets AS PERMISSIVE FOR SELECT TO public
  USING ((is_contributor_or_admin() OR (client_id = current_client_id()) OR (is_default AND client_owns_set_in_variant(variant_id))));

CREATE POLICY "client_sets_update" ON public.client_sets AS PERMISSIVE FOR UPDATE TO public
  USING (is_contributor_or_admin())
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "clients_delete" ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "clients_insert" ON public.clients AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "clients_select" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING ((is_contributor_or_admin() OR (id = current_client_id())));

CREATE POLICY "clients_update" ON public.clients AS PERMISSIVE FOR UPDATE TO public
  USING (is_contributor_or_admin())
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "drone_events_insert" ON public.drone_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM drones d
  WHERE (d.id = drone_events.drone_id))) AND ((kind = ANY (ARRAY['applied'::text, 'captured'::text])) OR is_contributor_or_admin())));

CREATE POLICY "drone_events_select" ON public.drone_events AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM drones d
  WHERE (d.id = drone_events.drone_id))));

CREATE POLICY "drones_delete" ON public.drones AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "drones_insert" ON public.drones AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "drones_select" ON public.drones AS PERMISSIVE FOR SELECT TO public
  USING ((is_contributor_or_admin() OR (client_id = current_client_id())));

CREATE POLICY "drones_update" ON public.drones AS PERMISSIVE FOR UPDATE TO public
  USING (is_contributor_or_admin())
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "families_select_all" ON public.families AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "families_write_admin" ON public.families AS PERMISSIVE FOR ALL TO public
  USING (is_admin());

CREATE POLICY "param_values_delete" ON public.param_values AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "param_values_insert" ON public.param_values AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_contributor_or_admin() OR (("current_role"() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM (param_versions pv
     JOIN client_sets cs ON ((cs.id = pv.client_set_id)))
  WHERE ((pv.id = param_values.param_version_id) AND (cs.client_id = current_client_id()) AND (cs.is_default = false)))))));

CREATE POLICY "param_values_select" ON public.param_values AS PERMISSIVE FOR SELECT TO public
  USING ((is_contributor_or_admin() OR (EXISTS ( SELECT 1
   FROM (param_versions pv
     JOIN client_sets cs ON ((cs.id = pv.client_set_id)))
  WHERE ((pv.id = param_values.param_version_id) AND ((cs.client_id = current_client_id()) OR (cs.is_default AND (EXISTS ( SELECT 1
           FROM client_sets owned
          WHERE ((owned.variant_id = cs.variant_id) AND (owned.client_id = current_client_id())))))))))));

CREATE POLICY "param_values_update" ON public.param_values AS PERMISSIVE FOR UPDATE TO public
  USING (is_contributor_or_admin())
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "param_versions_delete" ON public.param_versions AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "param_versions_insert" ON public.param_versions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((is_contributor_or_admin() OR (("current_role"() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM client_sets cs
  WHERE ((cs.id = param_versions.client_set_id) AND (cs.client_id = current_client_id()) AND (cs.is_default = false)))))));

CREATE POLICY "param_versions_select" ON public.param_versions AS PERMISSIVE FOR SELECT TO public
  USING ((is_contributor_or_admin() OR (EXISTS ( SELECT 1
   FROM client_sets cs
  WHERE ((cs.id = param_versions.client_set_id) AND ((cs.client_id = current_client_id()) OR (cs.is_default AND (EXISTS ( SELECT 1
           FROM client_sets owned
          WHERE ((owned.variant_id = cs.variant_id) AND (owned.client_id = current_client_id())))))))))));

CREATE POLICY "param_versions_update" ON public.param_versions AS PERMISSIVE FOR UPDATE TO public
  USING (is_contributor_or_admin())
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "variants_delete_admin" ON public.variants AS PERMISSIVE FOR DELETE TO public
  USING (is_admin());

CREATE POLICY "variants_insert_contributor" ON public.variants AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_contributor_or_admin());

CREATE POLICY "variants_select_all" ON public.variants AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "variants_update_owner" ON public.variants AS PERMISSIVE FOR UPDATE TO public
  USING (((created_by = auth.uid()) OR is_admin()));

DROP FUNCTION IF EXISTS public.client_owns_set_in_family(uuid);

ALTER TABLE public.param_versions ALTER COLUMN needs_review SET DEFAULT false;

UPDATE storage.buckets SET public = true WHERE id = 'param-files';

COMMIT;
