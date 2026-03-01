import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Anon key — respects RLS. Use in Server Components for public reads. */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Service role key — bypasses RLS. Use only in trusted API routes. */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
