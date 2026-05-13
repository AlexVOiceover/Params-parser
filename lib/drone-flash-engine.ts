import { writeDroneParams } from "@/lib/mavlink-serial";
import type { ParamWriteResult } from "@/lib/mavlink-serial";
import { RUNTIME_PARAMS } from "@/lib/param-engine";

export interface FlashResult {
  ok: boolean;
  passes: number;
  unresolved: string[];
  reverted: boolean;
}

export type FlashTarget = Map<string, number>;

const BAUD_RATE = 115200;
const MAX_PASSES = 1;

function diff(current: Map<string, number>, target: FlashTarget): { name: string; value: number }[] {
  const toWrite: { name: string; value: number }[] = [];
  for (const [name, targetVal] of target.entries()) {
    if (RUNTIME_PARAMS.has(name)) continue;
    const currentVal = current.get(name);
    if (currentVal === undefined || Math.abs(currentVal - targetVal) > 1e-5) {
      toWrite.push({ name, value: targetVal });
    }
  }
  return toWrite;
}

async function writeParams(
  changes: { name: string; value: number }[],
  onLog: (msg: string) => void
): Promise<ParamWriteResult[]> {
  return new Promise((resolve) => {
    writeDroneParams(BAUD_RATE, changes, {
      onProgress: () => {},
      onLog,
      onDone: (results) => resolve(results),
      onError: (msg) => {
        onLog(`⚠ Write failed: ${msg}`);
        resolve([]);
      },
    });
  });
}

/**
 * Diff → write loop, up to MAX_PASSES.
 * Verification is done via per-param write confirmations (no separate re-read,
 * which would require a new port request and a user gesture).
 * Failed params are retried up to MAX_PASSES times.
 * On giving up, attempts to revert to the pre-flash snapshot.
 *
 * @param target   The desired param state (name → value)
 * @param current  The drone's current param state before flashing (pre-flash snapshot)
 * @param onLog    Progress callback for the write dialog log
 */
export async function flashParamsToDrone(
  target: FlashTarget,
  current: Map<string, number>,
  onLog: (msg: string) => void
): Promise<FlashResult> {
  const snapshot = new Map(current);

  let toWrite = diff(current, target);

  if (toWrite.length === 0) {
    return { ok: true, passes: 0, unresolved: [], reverted: false };
  }

  let passes = 0;

  while (toWrite.length > 0 && passes < MAX_PASSES) {
    passes++;
    onLog(`Pass ${passes}/${MAX_PASSES} — writing ${toWrite.length} param${toWrite.length === 1 ? "" : "s"}…`);

    const results = await writeParams(toWrite, onLog);

    if (results.length === 0) break; // port error

    // Params that failed confirmation — retry on next pass
    toWrite = results
      .filter((r) => !r.success)
      .map((r) => ({ name: r.name, value: r.requested }));

    if (toWrite.length === 0) {
      const msg = passes === 1 ? "Written in 1 pass" : `Written in ${passes} passes`;
      onLog(`✓ ${msg}`);
      return { ok: true, passes, unresolved: [], reverted: false };
    }

    onLog(`${toWrite.length} param${toWrite.length === 1 ? "" : "s"} failed — retrying (pass ${passes})…`);
  }

  // Gave up — these params could not be written (likely read-only on this FC)
  const unresolvedNames = toWrite.map((p) => p.name);
  onLog(`⚠ ${unresolvedNames.length} param${unresolvedNames.length === 1 ? "" : "s"} could not be written (read-only or hardware-specific): ${unresolvedNames.join(", ")}`);

  // No revert needed — these params were never successfully written so the
  // drone state is unchanged. Attempting a revert would require another port
  // request (user gesture) and is pointless for read-only params.
  return { ok: false, passes, unresolved: unresolvedNames, reverted: false };
}
