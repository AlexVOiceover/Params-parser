"use server";

import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Dev-only shortcut: skip the email round-trip and log the user in directly
 * by generating a magic link via the service role and verifying its OTP.
 *
 * Returns:
 *   { ok: true }              on success
 *   { ok: false, error }      on validation/auth failure
 *   { ok: false, skipped: true } if not configured for dev (caller should fall back to signInWithOtp)
 */
export async function devSignIn(email: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; skipped: true }
> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, skipped: true };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, skipped: true };
  }
  if (!email?.trim()) {
    return { ok: false, error: "Email required" };
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim(),
  });
  if (linkErr || !linkData?.properties?.email_otp) {
    return { ok: false, error: linkErr?.message ?? "Could not generate link" };
  }

  const supabase = await createSessionClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (verifyErr) {
    return { ok: false, error: verifyErr.message };
  }

  return { ok: true };
}
