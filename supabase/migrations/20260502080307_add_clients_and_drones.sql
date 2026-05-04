-- ============================================================
-- Migration: add clients + drones tables; backfill from client_sets
-- ============================================================
-- New first-class entities:
--   clients (companies, e.g. "Acme Corp")
--   drones  (serial numbers belonging to a client)
-- client_sets gains nullable FKs to both. Defaults (serial='') keep
-- NULL FKs since they don't represent a real customer drone.
-- The free-text client_sets.client_name + serial columns stay this
-- migration so we can verify the link; Stage 04 drops them.

BEGIN;

-- ── clients ──────────────────────────────────────────────────

CREATE TABLE public.clients (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        UNIQUE NOT NULL,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_all"
  ON public.clients FOR SELECT
  USING (true);

CREATE POLICY "clients_insert_contributor"
  ON public.clients FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "clients_update_contributor"
  ON public.clients FOR UPDATE
  USING (public.is_contributor_or_admin());

CREATE POLICY "clients_delete_admin"
  ON public.clients FOR DELETE
  USING (public.is_admin());


-- ── drones ───────────────────────────────────────────────────

CREATE TABLE public.drones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  serial      text        NOT NULL,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, serial)
);

CREATE INDEX idx_drones_client ON public.drones (client_id);

ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drones_select_all"
  ON public.drones FOR SELECT
  USING (true);

CREATE POLICY "drones_insert_contributor"
  ON public.drones FOR INSERT
  WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "drones_update_contributor"
  ON public.drones FOR UPDATE
  USING (public.is_contributor_or_admin());

CREATE POLICY "drones_delete_admin"
  ON public.drones FOR DELETE
  USING (public.is_admin());


-- ── client_sets: add FK columns ──────────────────────────────

ALTER TABLE public.client_sets
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  ADD COLUMN drone_id  uuid REFERENCES public.drones(id)  ON DELETE RESTRICT;


-- ── Backfill ────────────────────────────────────────────────

-- 1. One clients row per distinct client_name.
INSERT INTO public.clients (name)
SELECT DISTINCT cs.client_name
FROM public.client_sets cs
WHERE cs.client_name IS NOT NULL
  AND cs.client_name <> ''
ON CONFLICT (name) DO NOTHING;

-- 2. One drones row per distinct (client_name, serial) where serial != ''.
INSERT INTO public.drones (client_id, serial)
SELECT DISTINCT c.id, cs.serial
FROM public.client_sets cs
JOIN public.clients c ON c.name = cs.client_name
WHERE cs.serial IS NOT NULL
  AND cs.serial <> ''
ON CONFLICT (client_id, serial) DO NOTHING;

-- 3. Link each non-Default client_set to its client + drone.
UPDATE public.client_sets cs
SET client_id = c.id,
    drone_id  = d.id
FROM public.clients c
JOIN public.drones d ON d.client_id = c.id
WHERE cs.client_name = c.name
  AND cs.serial = d.serial
  AND cs.serial <> '';

-- Sanity: every non-Default client_set should now have both FKs.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.client_sets
  WHERE serial <> ''
    AND (client_id IS NULL OR drone_id IS NULL);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Backfill missed % client_sets rows with non-empty serial', orphan_count;
  END IF;
END $$;

COMMIT;
