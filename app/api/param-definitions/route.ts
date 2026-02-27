import { NextResponse } from "next/server";

const PDEF_URL =
  "https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json";

interface PdefRaw {
  [groupKey: string]: {
    [paramName: string]: Record<string, unknown>;
  };
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.has("force");
  try {
    const res = await fetch(PDEF_URL, force
      ? { cache: "no-store" }
      : { next: { revalidate: 86400 } }
    );

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

    return NextResponse.json({ params, groups, fetchedAt: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
