import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

const ROLES = ["viewer", "contributor", "admin", "client"] as const;
type Role = (typeof ROLES)[number];

async function requireAdmin() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { email?: string; role?: string; clientId?: string | null };
  const email = body.email?.trim();
  const role = (body.role ?? "contributor") as Role;
  const clientId = body.clientId ?? null;

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "client" && !clientId) return NextResponse.json({ error: "Client required for client role" }, { status: 400 });
  if (role !== "client" && clientId) return NextResponse.json({ error: "Client must be empty for non-client roles" }, { status: 400 });

  const admin = createAdminClient();
  // Without redirectTo the invite link points at Supabase's default Site URL
  // instead of this app's callback, and the invited user lands on an auth error.
  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback`;

  let userId: string | null = null;
  let resent = false;

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (invited?.user) {
    userId = invited.user.id;
  } else {
    // Already invited: inviteUserByEmail refuses a second time, which used to
    // leave no way to resend. Send a fresh magic link instead so the admin can
    // recover a lost or expired invite, and update the role either way.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", email.split("@")[0])
      .maybeSingle();

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.user) {
      return NextResponse.json(
        { error: inviteErr?.message ?? linkErr?.message ?? "Invite failed" },
        { status: 500 }
      );
    }
    userId = linkData.user.id ?? existing?.id ?? null;
    resent = true;
  }

  if (!userId) {
    return NextResponse.json({ error: "Could not resolve the invited user" }, { status: 500 });
  }

  // Upsert the profile row with the chosen role and client_id.
  // We don't rely on the on_auth_user_created trigger for this — Supabase has
  // been observed to drop triggers on auth.users; upserting is idempotent and
  // captures both the "trigger fired" and "trigger missed" cases.
  const username = email.split("@")[0];
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, username, role, client_id: clientId });

  if (profileErr) {
    return NextResponse.json({ error: `Invite sent but role update failed: ${profileErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resent });
}
