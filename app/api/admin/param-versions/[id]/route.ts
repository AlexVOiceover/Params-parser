import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { latestApproved } from "@/lib/versions";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: proposal } = await admin
    .from("param_versions")
    .select("client_set_id, version_label, needs_review")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: siblings } = await admin
    .from("param_versions")
    .select("id, version_label, needs_review")
    .eq("client_set_id", proposal.client_set_id);
  const target = latestApproved(siblings ?? []);
  if (target && parseInt(target.version_label, 10) > parseInt(proposal.version_label, 10)) {
    return NextResponse.json(
      { error: `v${target.version_label} was approved after this proposal. Delete it, or restore it as a new version.` },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("param_versions")
    .update({ needs_review: false, is_latest: true })
    .eq("id", id);
  if (!error) {
    await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", proposal.client_set_id).neq("id", id);
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: version } = await admin
    .from("param_versions")
    .select("storage_path, client_set_id, is_latest")
    .eq("id", id)
    .single();

  // History the drone log points at is permanent; supersede it with a new version instead.
  const { count } = await admin
    .from("drone_events")
    .select("id", { count: "exact", head: true })
    .eq("param_version_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "A drone was verified on this version, so it stays in the history. Restore another version to replace it." },
      { status: 409 }
    );
  }

  const { error } = await admin.from("param_versions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If we just deleted the latest version, promote the next most-recent one.
  if (version?.is_latest && version.client_set_id) {
    const { data: next } = await admin
      .from("param_versions")
      .select("id")
      .eq("client_set_id", version.client_set_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin.from("param_versions").update({ is_latest: true }).eq("id", next.id);
    }
  }

  if (version?.storage_path) {
    await admin.storage.from("param-files").remove([version.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
