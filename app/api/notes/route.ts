import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import type { ParamNotes } from "@/lib/types";

export async function GET() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ notes: {} });

  const { data } = await supabase
    .from("param_notes")
    .select("param_name, note")
    .eq("user_id", user.id);

  const notes: ParamNotes = {};
  for (const row of data ?? []) {
    notes[row.param_name] = row.note;
  }

  return NextResponse.json({ notes });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const notes: ParamNotes = await request.json();

  await supabase.from("param_notes").delete().eq("user_id", user.id);

  const rows = Object.entries(notes)
    .filter(([, note]) => note.trim())
    .map(([param_name, note]) => ({ user_id: user.id, param_name, note }));

  if (rows.length > 0) {
    await supabase.from("param_notes").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
