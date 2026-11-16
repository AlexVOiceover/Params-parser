-- Feature 20: chip-ID identity and desired-state config.
--
-- A drone record is linked to one physical flight controller by the MCU's
-- factory-burned unique ID (AUTOPILOT_VERSION.uid2). NULL = not linked yet;
-- records, histories and versions all work without it.
--
-- drone_events is the append-only audit log: links, and applies/captures
-- that were verified by reading the drone back. No UPDATE or DELETE policy
-- exists, so rows can never be edited or removed through the API.

BEGIN;

ALTER TABLE public.drones
  ADD COLUMN chip_id text UNIQUE
    CHECK (chip_id IS NULL OR chip_id ~ '^[0-9A-F]{24}$');

ALTER TABLE public.param_versions
  ADD COLUMN firmware text
    CHECK (firmware IS NULL OR firmware ~ '^\d+\.\d+\.\d+$');

CREATE TABLE public.drone_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id          uuid        NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  param_version_id  uuid        REFERENCES public.param_versions(id) ON DELETE SET NULL,
  chip_id           text,
  firmware          text,
  kind              text        NOT NULL
    CHECK (kind IN ('applied', 'captured', 'linked', 'relinked', 'unlinked')),
  diff_count        integer,
  method            text
    CHECK (method IS NULL OR method IN ('connect', 'messages_line', 'assembly')),
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drone_events_drone ON public.drone_events (drone_id, created_at DESC);

ALTER TABLE public.drone_events ENABLE ROW LEVEL SECURITY;

-- Visible to anyone who can see the drone (drones RLS applies in the subquery).
CREATE POLICY "drone_events_select"
  ON public.drone_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.drones d WHERE d.id = drone_id));

-- Link events: staff only. Applies/captures: anyone who can see the drone.
CREATE POLICY "drone_events_insert"
  ON public.drone_events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.drones d WHERE d.id = drone_id)
    AND (
      kind IN ('applied', 'captured')
      OR public.is_contributor_or_admin()
    )
  );

COMMIT;
