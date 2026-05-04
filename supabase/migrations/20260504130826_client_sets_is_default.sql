-- Explicit boolean flag for the per-variant "Default" client_set.
-- Today, Defaults are identified by `client_name = 'Default' AND serial = ''`.
-- Promoting that to a real column lets RLS policies key on it cleanly without
-- string matching, and lets us enforce one-Default-per-variant with an index.

ALTER TABLE public.client_sets
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

UPDATE public.client_sets
   SET is_default = true
 WHERE serial = '' AND client_name = 'Default';

CREATE UNIQUE INDEX client_sets_one_default_per_variant
  ON public.client_sets (variant_id) WHERE is_default;
