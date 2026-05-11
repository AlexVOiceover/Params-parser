import { openDroneConnection, writeDroneParams } from "@/lib/mavlink-serial";
import { RUNTIME_PARAMS } from "@/lib/param-engine";

export interface FlashResult {
  ok: boolean;
  passes: number;
  unresolved: string[];
  reverted: boolean;
}

export type FlashTarget = Map<string, number>;

const BAUD_RATE = 115200;
const MAX_PASSES = 4;

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

async function readAllParams(onLog: (msg: string) => void): Promise<Map<string, number> | null> {
  return new Promise((resolve) => {
    openDroneConnection(BAUD_RATE, {
      onProgress: () => {},
      onLog,
      onDone: (params) => {
        const map = new Map<string, number>();
        for (const { name, value } of params) {
          const n = parseFloat(value);
          if (Number.isFinite(n)) map.set(name, n);
        }
        resolve(map);
      },
      onError: (msg) => {
        onLog(`⚠ Re-read failed: ${msg}`);
        resolve(null);
      },
    });
  });
}

async function writeParams(
  changes: { name: string; value: number }[],
  onLog: (msg: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    writeDroneParams(BAUD_RATE, changes, {
      onProgress: () => {},
      onLog,
      onDone: () => resolve(true),
      onError: (msg) => {
        onLog(`⚠ Write failed: ${msg}`);
        resolve(false);
      },
    });
  });
}

/**
 * Diff → write → re-read → re-diff loop, up to MAX_PASSES.
 * On persistent failure, attempts to revert to the pre-flash snapshot.
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
  let live = new Map(current);

  while (toWrite.length > 0 && passes < MAX_PASSES) {
    passes++;
    onLog(`Pass ${passes}/${MAX_PASSES} — writing ${toWrite.length} param${toWrite.length === 1 ? "" : "s"}…`);

    const writeOk = await writeParams(toWrite, onLog);
    if (!writeOk) break;

    onLog(`Re-reading params to verify…`);
    const fresh = await readAllParams(onLog);
    if (!fresh) break;

    live = fresh;
    toWrite = diff(live, target);

    if (toWrite.length === 0) {
      const msg = passes === 1 ? "Written in 1 pass" : `Written in ${passes} passes`;
      onLog(`✓ ${msg}`);
      return { ok: true, passes, unresolved: [], reverted: false };
    }

    onLog(`${toWrite.length} param${toWrite.length === 1 ? "" : "s"} still differ after pass ${passes}`);
  }

  // Failed — attempt revert to pre-flash snapshot
  const unresolvedNames = toWrite.map((p) => p.name);
  onLog(`⚠ ${unresolvedNames.length} param${unresolvedNames.length === 1 ? "" : "s"} unresolved after ${passes} passes — reverting…`);

  const revertChanges = unresolvedNames
    .map((name) => ({ name, value: snapshot.get(name) }))
    .filter((p): p is { name: string; value: number } => p.value !== undefined);

  let reverted = false;
  if (revertChanges.length > 0) {
    const revertOk = await writeParams(revertChanges, onLog);
    reverted = revertOk;
    onLog(revertOk ? "Reverted to previous state" : "⚠ Revert also failed — some params may be in an unknown state");
  }

  return { ok: false, passes, unresolved: unresolvedNames, reverted };
}
