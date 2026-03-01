-- ============================================================
-- Migration 001: Initial schema
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────
-- Extends Supabase built-in auth.users.
-- Created automatically on first login via trigger.

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username    text        UNIQUE NOT NULL,
  role        text        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('viewer', 'contributor', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'viewer'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Protection Lists ─────────────────────────────────────────
-- Replaces Vercel KV. owner_id NULL = global (admin-managed).
-- rules column: [{type: 'exact'|'prefix', value: string}]

CREATE TABLE public.protection_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  rules       jsonb       NOT NULL DEFAULT '[]',
  owner_id    uuid        REFERENCES public.profiles ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_protection_lists_owner ON public.protection_lists (owner_id);


-- ── Drone Types ───────────────────────────────────────────────

CREATE TABLE public.drone_types (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text  UNIQUE NOT NULL,   -- e.g. 'x500', 'iris-plus'
  name        text  NOT NULL,
  description text
);


-- ── Firmwares ─────────────────────────────────────────────────

CREATE TABLE public.firmwares (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_type_id  uuid  NOT NULL REFERENCES public.drone_types ON DELETE CASCADE,
  version        text  NOT NULL,        -- e.g. '4.5.7'
  release_date   date,
  UNIQUE (drone_type_id, version)
);

CREATE INDEX idx_firmwares_drone_type ON public.firmwares (drone_type_id);


-- ── Param Sets ────────────────────────────────────────────────
-- A named param configuration (the "document").

CREATE TABLE public.param_sets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  drone_type_id  uuid        REFERENCES public.drone_types ON DELETE SET NULL,
  firmware_id    uuid        REFERENCES public.firmwares ON DELETE SET NULL,
  published      bool        NOT NULL DEFAULT false,
  created_by     uuid        REFERENCES public.profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_param_sets_drone_type  ON public.param_sets (drone_type_id);
CREATE INDEX idx_param_sets_published   ON public.param_sets (published);
CREATE INDEX idx_param_sets_created_by  ON public.param_sets (created_by);


-- ── Param Versions ────────────────────────────────────────────
-- Versioned snapshots of a param set, stored in Supabase Storage.

CREATE TABLE public.param_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  param_set_id   uuid        NOT NULL REFERENCES public.param_sets ON DELETE CASCADE,
  version_label  text        NOT NULL,   -- e.g. 'v1.0', 'v1.2-hotfix'
  storage_path   text        NOT NULL,   -- Supabase Storage key
  changelog      text,
  created_by     uuid        REFERENCES public.profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  is_latest      bool        NOT NULL DEFAULT false,
  UNIQUE (param_set_id, version_label)
);

CREATE INDEX idx_param_versions_param_set ON public.param_versions (param_set_id);
CREATE INDEX idx_param_versions_latest    ON public.param_versions (param_set_id, is_latest);
