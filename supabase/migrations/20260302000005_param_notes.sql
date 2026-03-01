-- ============================================================
-- Migration 005: param_notes — per-user notes on parameters
-- ============================================================

CREATE TABLE public.param_notes (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  param_name  text        NOT NULL,
  note        text        NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, param_name)
);

ALTER TABLE public.param_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_all_own"
  ON public.param_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
