/** A display name as typed, tidied; or why it cannot be used. */
export function cleanUsername(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Name required" };
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 2) return { ok: false, error: "Use at least 2 characters" };
  if (value.length > 40) return { ok: false, error: "Use at most 40 characters" };
  return { ok: true, value };
}

/** Postgres unique_violation: the name belongs to someone else. */
export const USERNAME_TAKEN = "23505";
