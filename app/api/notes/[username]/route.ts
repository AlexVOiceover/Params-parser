import { NextResponse } from "next/server";
import type { ParamNotes } from "@/lib/types";

function kvKey(username: string) {
  return `notes:${username.toLowerCase()}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<ParamNotes>(kvKey(username));
    return NextResponse.json({ notes: data ?? {} });
  } catch {
    return NextResponse.json({ notes: {} });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  try {
    const notes: ParamNotes = await req.json();
    const { kv } = await import("@vercel/kv");
    await kv.set(kvKey(username), notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
