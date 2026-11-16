import { NextResponse } from "next/server";

// Notes require per-user authentication (Phase 3). Until then they are session-only.
export async function GET() {
  return NextResponse.json({ notes: {} });
}

export async function PUT() {
  return NextResponse.json({ ok: true });
}
