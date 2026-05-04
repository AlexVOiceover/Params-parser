-- Helpers used by the upcoming RLS rewrite.
-- `is_admin()` and `is_contributor_or_admin()` already exist (from initial RLS).
-- Adding two more so policies can express "this user's role" and
-- "this user's client_id" without re-querying profiles inline (which would
-- recurse against the profiles RLS policy).

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;
