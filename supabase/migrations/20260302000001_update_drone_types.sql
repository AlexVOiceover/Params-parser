-- ============================================================
-- Migration 004: Replace demo drone types with actual fleet
-- ============================================================

-- Remove demo/placeholder drone types (firmwares cascade automatically)
DELETE FROM public.drone_types
WHERE slug IN ('arducopter-generic', 'x500', 'iris-plus', 'arduplane-generic');

-- Insert real fleet drone types
INSERT INTO public.drone_types (slug, name, description) VALUES
  ('air8',            'AIR8',               NULL),
  ('air4rugged',      'AIR4Rugged',         NULL),
  ('air4rugged-mt10', 'AIR4Rugged + MT10',  NULL),
  ('saudi',           'Saudi',              NULL)
ON CONFLICT (slug) DO NOTHING;
