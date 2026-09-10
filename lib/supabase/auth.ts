import { createSessionClient } from "@/lib/supabase/server";

export type Role = "viewer" | "contributor" | "admin" | "client";

export interface Caller {
  id: string;
  role: Role;
  clientId: string | null;
}

/**
 * Resolve the caller's identity and role from the session cookie.
 * Returns null when signed out or when no profile row exists.
 */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();
  if (!profile?.role) return null;

  return {
    id: user.id,
    role: profile.role as Role,
    clientId: (profile.client_id as string | null) ?? null,
  };
}

/**
 * Resolve the caller and assert they hold one of `roles`.
 *
 * The same auth-and-role check was previously hand-copied across ~34 routes
 * and pages in three different role combinations, so a missing check was
 * invisible. Route handlers should go through here instead.
 */
export async function requireRole(roles: readonly Role[]): Promise<Caller | null> {
  const caller = await getCaller();
  if (!caller) return null;
  return roles.includes(caller.role) ? caller : null;
}

/** Convenience wrappers for the two role sets used across the admin API. */
export const requireAdmin = () => requireRole(["admin"]);
export const requireContributor = () => requireRole(["contributor", "admin"]);
