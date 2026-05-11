-- Allow orphan drones (no client assigned at registration time)
ALTER TABLE public.drones ALTER COLUMN client_id DROP NOT NULL;

-- Replace UNIQUE(client_id, serial) with two partial indexes:
-- one for drones with a client, one for orphans (client_id IS NULL)
ALTER TABLE public.drones DROP CONSTRAINT IF EXISTS drones_client_id_serial_key;
CREATE UNIQUE INDEX IF NOT EXISTS drones_serial_client_unique
  ON public.drones (client_id, serial)
  WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drones_serial_orphan_unique
  ON public.drones (serial)
  WHERE client_id IS NULL;
