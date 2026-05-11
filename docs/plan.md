# 15 Fleet Bring-Up

> Wire the flash engine into RegisterDroneModal and close the remaining gaps found during audit.

## Tasks

1. [ ] **Wire flash engine into RegisterDroneModal**
   - [ ] 1.1 Import `flashParamsToDrone` from `lib/drone-flash-engine`
   - [ ] 1.2 Pass `onStart` to `WriteDroneDialog`: build the current drone map from `droneParams` and call `flashParamsToDrone(target, current, addLog)`
   - [ ] 1.3 On `FlashResult.ok === false` set stage to "error" with the unresolved/revert message from the result

2. [ ] **Ensure SCR_USER2 is in the flash target**
   - [ ] 2.1 After building the `target` map from `param_values`, explicitly set `target.set("SCR_USER2", parseInt(latestPV.version_label, 10))` so the version marker is always written regardless of whether it was injected at upload time

3. [ ] **Fix done screen version label**
   - [ ] 3.1 Store `latestPV.version_label` in state (e.g. `flashedVersion`) after fetching it
   - [ ] 3.2 Replace the hardcoded `"v1"` in the done screen with `v{flashedVersion}`

4. [ ] **Typecheck**
   - [ ] 4.1 `npx tsc --noEmit` — fix any errors

## Notes

- The `target` map is built inside `handleFlash` and is in scope when `setWriteChanges(diff)` is called — pass it through to the `onStart` callback via a ref or state to avoid stale closure
- `flashParamsToDrone` takes `(target: FlashTarget, current: Map<string, number>, onLog)` — `current` is built from `droneParams` the same way the diff already builds `droneMap`
- The existing `handleWriteSuccess` updates `droneParams` context from `written[]` — with the flash engine, `onSuccess` is called with synthesised results (all changes marked success); this is the same pattern as `ApplyUpdateButton`
