-- ============================================================
-- Fix privilege escalation via profiles UPDATE
-- ============================================================
-- "profiles_update_own" had a USING clause but no WITH CHECK, so any signed-in
-- user could update their own row — including setting role='admin' or pointing
-- client_id at another company. USING gates which rows you may update; only
-- WITH CHECK constrains the values you may write.
--
-- Non-admins may now only change their username. role and client_id are
-- immutable to them; admins remain unrestricted.

BEGIN;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      -- Values must match what is already stored: no self-promotion, no
      -- reassigning yourself to a different client.
      AND role IS NOT DISTINCT FROM public.current_role()
      AND client_id IS NOT DISTINCT FROM public.current_client_id()
    )
  );

COMMIT;
