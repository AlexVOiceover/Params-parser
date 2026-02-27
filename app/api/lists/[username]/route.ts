import { NextResponse } from "next/server";
import { DEFAULT_PROTECTION_LISTS } from "@/lib/param-engine";
import type { ProtectionList } from "@/lib/types";

function kvKey(username: string) {
  return `lists:${username.toLowerCase()}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<ProtectionList[]>(kvKey(username));
    if (!data || data.length === 0) {
      return NextResponse.json(DEFAULT_PROTECTION_LISTS);
    }
    return NextResponse.json(data);
  } catch {
    // KV not configured (local dev) — return defaults
    return NextResponse.json(DEFAULT_PROTECTION_LISTS);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  try {
    const lists: ProtectionList[] = await req.json();
    const { kv } = await import("@vercel/kv");
    await kv.set(kvKey(username), lists);
    return NextResponse.json({ ok: true });
  } catch {
    // KV not configured (local dev) — silently succeed
    return NextResponse.json({ ok: true });
  }
}
