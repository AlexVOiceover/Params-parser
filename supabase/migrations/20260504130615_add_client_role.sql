-- Add the `client` role and link it to a row in `clients`.
--
-- A user with role='client' represents one specific company's account.
-- They can only see/upload to that company's data (enforced by RLS, in a
-- follow-up migration).

-- 1. Add client_id column (nullable; required only for the 'client' role).
ALTER TABLE public.profiles
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Drop the existing inline role check (whatever its system name is) and
--    replace it with a named one that includes 'client'.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%IN%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('viewer', 'contributor', 'admin', 'client'));

-- 3. The 'client' role MUST have a client_id; every other role MUST NOT.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_client_id_matches_role
  CHECK (
    (role = 'client' AND client_id IS NOT NULL)
    OR (role <> 'client' AND client_id IS NULL)
  );
