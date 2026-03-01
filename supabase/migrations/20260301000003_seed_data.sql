-- ============================================================
-- Migration 003: Seed data
-- ============================================================
-- Initial drone types, firmwares, and global protection lists.
-- Edit freely as your fleet grows.


-- ── Drone types ───────────────────────────────────────────────

INSERT INTO public.drone_types (slug, name, description) VALUES
  ('arducopter-generic', 'ArduCopter (Generic)',   'Multi-rotor running ArduCopter firmware'),
  ('x500',               'X500',                   'Holybro X500 quadcopter frame'),
  ('iris-plus',          'Iris+',                  '3DR Iris+ quadcopter'),
  ('arduplane-generic',  'ArduPlane (Generic)',     'Fixed-wing running ArduPlane firmware')
ON CONFLICT (slug) DO NOTHING;


-- ── Firmwares ─────────────────────────────────────────────────

INSERT INTO public.firmwares (drone_type_id, version, release_date)
SELECT id, '4.5.7', '2024-10-01' FROM public.drone_types WHERE slug = 'arducopter-generic'
ON CONFLICT (drone_type_id, version) DO NOTHING;

INSERT INTO public.firmwares (drone_type_id, version, release_date)
SELECT id, '4.5.7', '2024-10-01' FROM public.drone_types WHERE slug = 'x500'
ON CONFLICT (drone_type_id, version) DO NOTHING;

INSERT INTO public.firmwares (drone_type_id, version, release_date)
SELECT id, '4.5.7', '2024-10-01' FROM public.drone_types WHERE slug = 'iris-plus'
ON CONFLICT (drone_type_id, version) DO NOTHING;

INSERT INTO public.firmwares (drone_type_id, version, release_date)
SELECT id, '4.5.7', '2024-10-01' FROM public.drone_types WHERE slug = 'arduplane-generic'
ON CONFLICT (drone_type_id, version) DO NOTHING;


-- ── Global protection lists ───────────────────────────────────
-- Migrated from data/protection-lists.json.
-- owner_id is NULL → global (admin-managed).

INSERT INTO public.protection_lists (name, description, rules, owner_id) VALUES

('Calibration Parameters',
 'Sensor calibration values specific to each individual drone. These must never be overwritten by a fleet-wide param push.',
 '[
   {"type":"prefix","value":"COMPASS_OFS"},
   {"type":"prefix","value":"COMPASS_DIA"},
   {"type":"prefix","value":"COMPASS_MOT"},
   {"type":"prefix","value":"COMPASS_ODI"},
   {"type":"prefix","value":"COMPASS_SCALE"},
   {"type":"prefix","value":"INS_ACC"},
   {"type":"prefix","value":"INS_GYR"},
   {"type":"prefix","value":"INS_ACCOFFS"},
   {"type":"prefix","value":"INS_ACCSCAL"},
   {"type":"prefix","value":"INS_GYROFFS"},
   {"type":"prefix","value":"BARO1_GND"},
   {"type":"prefix","value":"BARO2_GND"},
   {"type":"prefix","value":"BARO3_GND"},
   {"type":"exact","value":"AHRS_TRIM_X"},
   {"type":"exact","value":"AHRS_TRIM_Y"},
   {"type":"exact","value":"AHRS_TRIM_Z"},
   {"type":"exact","value":"MOT_THST_HOVER"}
 ]'::jsonb,
 NULL),

('Hardware & Board Config',
 'Device IDs, board type, and serial numbers that identify this specific hardware.',
 '[
   {"type":"prefix","value":"COMPASS_DEV_ID"},
   {"type":"prefix","value":"COMPASS_PRIO"},
   {"type":"prefix","value":"INS_GYR_ID"},
   {"type":"prefix","value":"INS_ACC_ID"},
   {"type":"prefix","value":"BARO1_DEVID"},
   {"type":"prefix","value":"BARO2_DEVID"},
   {"type":"prefix","value":"BARO3_DEVID"},
   {"type":"prefix","value":"STAT_"},
   {"type":"exact","value":"SYSID_THISMAV"},
   {"type":"exact","value":"BRD_SERIAL_NUM"},
   {"type":"exact","value":"BRD_TYPE"},
   {"type":"exact","value":"FORMAT_VERSION"}
 ]'::jsonb,
 NULL),

('RC Calibration',
 'RC channel min/max/trim calibration and channel mapping. Specific to each radio and transmitter setup.',
 '[
   {"type":"prefix","value":"RC1_"},
   {"type":"prefix","value":"RC2_"},
   {"type":"prefix","value":"RC3_"},
   {"type":"prefix","value":"RC4_"},
   {"type":"prefix","value":"RC5_"},
   {"type":"prefix","value":"RC6_"},
   {"type":"prefix","value":"RC7_"},
   {"type":"prefix","value":"RC8_"},
   {"type":"prefix","value":"RC9_"},
   {"type":"prefix","value":"RC10_"},
   {"type":"prefix","value":"RC11_"},
   {"type":"prefix","value":"RC12_"},
   {"type":"prefix","value":"RC13_"},
   {"type":"prefix","value":"RC14_"},
   {"type":"prefix","value":"RC15_"},
   {"type":"prefix","value":"RC16_"},
   {"type":"prefix","value":"RCMAP_"}
 ]'::jsonb,
 NULL);
