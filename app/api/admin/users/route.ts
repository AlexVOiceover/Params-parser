import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { cleanUsername } from "@/lib/username";

const ROLES = ["contributor", "admin", "client"] as const;
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

  const body = await request.json() as { email?: string; name?: string | null; role?: string; clientId?: string | null };
  const email = body.email?.trim();
  const role = (body.role ?? "contributor") as Role;
  const clientId = body.clientId ?? null;

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "client" && !clientId) return NextResponse.json({ error: "Client required for client role" }, { status: 400 });
  if (role !== "client" && clientId) return NextResponse.json({ error: "Client must be empty for non-client roles" }, { status: 400 });

  const admin = createAdminClient();

  // The name typed in the invite becomes the account's name. Names are unique,
  // so refuse before sending anything if it belongs to someone else.
  let name: string | null = null;
  if (body.name) {
    const cleaned = cleanUsername(body.name);
    if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });
    name = cleaned.value;
    const { data: holder } = await admin.from("profiles").select("id").eq("username", name).maybeSingle();
    if (holder) {
      const { data: holderUser } = await admin.auth.admin.getUserById(holder.id);
      if (holderUser.user?.email?.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: "Someone else already has that name" }, { status: 409 });
      }
    }
  }

  // Without redirectTo the invite link points at Supabase's default Site URL
  // instead of this app's callback, and the invited user lands on an auth error.
  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback`;

  let userId: string | null = null;
  let resent = false;

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { username: name ?? email.split("@")[0] },
  });

  if (invited?.user) {
    userId = invited.user.id;
  } else {
    // Already invited: inviteUserByEmail refuses a second time, which used to
    // leave no way to resend. Send a fresh magic link instead so the admin can
    // recover a lost or expired invite, and update the role either way.
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
    userId = linkData.user.id;
    resent = true;
  }

  if (!userId) {
    return NextResponse.json({ error: "Could not resolve the invited user" }, { status: 500 });
  }

  // Write the profile row with the chosen role and client_id ourselves rather
  // than relying on the on_auth_user_created trigger: Supabase has been observed
  // to drop triggers on auth.users. An existing row keeps its name unless a new
  // one was typed, since it may have been changed after the first invite.
  const { data: current } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  const { error: profileErr } = current
    ? await admin.from("profiles").update({ role, client_id: clientId, ...(name ? { username: name } : {}) }).eq("id", userId)
    : await admin.from("profiles").insert({ id: userId, username: name ?? email.split("@")[0], role, client_id: clientId });

  if (profileErr) {
    return NextResponse.json({ error: `Invite sent but role update failed: ${profileErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resent });
}
