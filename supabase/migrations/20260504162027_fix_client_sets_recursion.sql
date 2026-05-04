-- Fix infinite recursion in `client_sets_select`.
--
-- The previous policy did:
--   ... OR (is_default AND EXISTS (SELECT 1 FROM client_sets cs ...))
-- That inner SELECT against client_sets re-applied the same policy, recursing.
--
-- Wrap the inner check in a SECURITY DEFINER function so it bypasses RLS
-- on its single use, while leaving the table's RLS strict for everyone else.

CREATE OR REPLACE FUNCTION public.client_owns_set_in_variant(target_variant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_sets
    WHERE variant_id = target_variant
      AND client_id = public.current_client_id()
  );
$$;

DROP POLICY IF EXISTS "client_sets_select" ON public.client_sets;

CREATE POLICY "client_sets_select"
  ON public.client_sets FOR SELECT
  USING (
    public.is_contributor_or_admin()
    OR client_id = public.current_client_id()
    OR (is_default AND public.client_owns_set_in_variant(variant_id))
  );
