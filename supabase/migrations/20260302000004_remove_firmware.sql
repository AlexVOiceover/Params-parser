-- ============================================================
-- Migration: Remove firmware_id from param_sets, drop firmwares table
-- ============================================================

ALTER TABLE public.param_sets DROP COLUMN IF EXISTS firmware_id;
DROP TABLE IF EXISTS public.firmwares;
