# 14 Differential Flash Engine

> Wrap the existing single-pass write in a retry-and-revert loop: diff → write → re-read → re-diff, up to 4 passes. Revert to pre-flash snapshot on failure. Wire ApplyUpdateButton up to the new engine.

## Tasks

1. [x] **Create `lib/drone-flash-engine.ts`**
   - [x]    - [x] 1.1 Define `FlashResult` type: `{ ok: boolean; passes: number; unresolved: string[]; reverted: boolean }`
   - [x]    - [x] 1.2 Define `FlashTarget` as `Map<string, number>` (param name → target value)
   - [x]    - [x] 1.3 Export `flashParamsToDrone(target: FlashTarget, onLog: (msg: string) => void): Promise<FlashResult>`
   - [x]    - [x] 1.4 Inside the function: snapshot pre-flash drone params from `useDroneParams` context — accept as a `current: Map<string, number>` parameter instead of reading from context (keeps it pure/testable)
   - [x]    - [x] 1.5 Diff pass: build `toWrite` list of params where `target[name] !== current[name]`, excluding `RUNTIME_PARAMS`
   - [x]    - [x] 1.6 If `toWrite` is empty, return `{ ok: true, passes: 0, unresolved: [], reverted: false }` immediately
   - [x]    - [x] 1.7 Write pass: call `writeDroneParams` (from `lib/mavlink-serial.ts`) with `toWrite`; collect results
   - [x]    - [x] 1.8 Re-read pass: call `openDroneConnection` to read all params fresh; update `current` map
   - [x]    - [x] 1.9 Re-diff: build new `toWrite` from updated current vs target; if empty → success
   - [x]    - [x] 1.10 Loop steps 1.7–1.9 up to 4 passes total; track pass count
   - [x]    - [x] 1.11 On giving up: attempt revert by writing `current` (pre-flash snapshot) back for each unresolved param
   - [x]    - [x] 1.12 Return `FlashResult` with correct `ok`, `passes`, `unresolved` names, and `reverted` flag

2. [x] **Update `WriteDroneDialog` to accept flash result messaging**
   - [x]    - [x] 2.1 After `onDone` fires, if `passes > 1` show "Written in N passes" in the log
   - [x]    - [x] 2.2 If `unresolved.length > 0` show each unresolved param name in the log with a warning
   - [x]    - [x] 2.3 If `reverted` show "Reverted to previous state" in the log

3. [x] **Wire `ApplyUpdateButton` to the flash engine**
   - [x]    - [x] 3.1 Replace `WriteDroneDialog`'s direct `writeDroneParams` call with `flashParamsToDrone` — pass `target` map and the current drone params map
   - [x]    - [x] 3.2 Pass `onLog` through so progress messages appear in the dialog log
   - [x]    - [x] 3.3 On `FlashResult` with `ok: false`, surface unresolved params in the existing error display

4. [x] **Typecheck**
   - [x]    - [x] 4.1 `npx tsc --noEmit` — fix any errors

## Notes

- `writeDroneParams` already handles per-param retry (3 attempts with 2s timeout each) — the engine's outer loop handles re-read and re-diff at a higher level
- Re-read uses `openDroneConnection` which opens the port fresh; the write step closes it — this alternating open/close is the existing pattern
- The `current` param snapshot must be captured BEFORE the first write so revert has a known-good state
- `RUNTIME_PARAMS` exclusion must happen in the diff step, same as today in `ApplyUpdateButton`
- Keep `WriteDroneDialog` UI unchanged — only the callbacks and data flowing into it change
