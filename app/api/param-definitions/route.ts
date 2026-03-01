import { NextResponse } from "next/server";

const PDEF_URL =
  "https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json";

const TTL = 86_400_000; // 24 h in ms

interface PdefRaw {
  [groupKey: string]: {
    [paramName: string]: Record<string, unknown>;
  };
}

// Module-level in-memory cache — survives across requests within the same process.
// Bypasses Next.js fetch cache (which rejects responses > 2 MB).
let cached: { data: object; at: number } | null = null;

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.has("force");

  if (!force && cached && Date.now() - cached.at < TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(PDEF_URL, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ArduPilot returned ${res.status}` },
        { status: 502 }
      );
    }

    const raw: PdefRaw = await res.json();

    const params: Record<string, Record<string, unknown>> = {};
    const groups: string[] = [];

    for (const [groupKey, members] of Object.entries(raw)) {
      if (typeof members !== "object" || members === null) continue;
      groups.push(groupKey);
      for (const [name, meta] of Object.entries(members)) {
        if (typeof meta === "object" && meta !== null) {
          params[name] = meta;
        }
      }
    }

    const data = { params, groups, fetchedAt: Date.now() };
    cached = { data, at: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
