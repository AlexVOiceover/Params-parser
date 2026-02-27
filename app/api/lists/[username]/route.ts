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
      return NextResponse.json({ lists: DEFAULT_PROTECTION_LISTS, source: "defaults" });
    }
    return NextResponse.json({ lists: data, source: "kv" });
  } catch (err) {
    console.error("[lists/GET] KV error:", err);
    return NextResponse.json({ lists: DEFAULT_PROTECTION_LISTS, source: "error", error: String(err) });
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
  } catch (err) {
    console.error("[lists/PUT] KV error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
