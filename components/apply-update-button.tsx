"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDroneParams } from "@/lib/drone-params-context";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import { clearDroneMatchCache } from "@/lib/use-connected-drone-match";
import { RUNTIME_PARAMS } from "@/lib/param-engine";
import { flashParamsToDrone } from "@/lib/drone-flash-engine";
import type { ParamWriteResult } from "@/lib/mavlink-serial";

interface Props {
  /** The param_version id to apply. */
  versionId: string;
  className?: string;
  label?: string;
}

/**
 * Fetches the target version's params, diffs against the connected drone's
 * current params, and opens WriteDroneDialog with only the changed params.
 */
export function ApplyUpdateButton({ versionId, className, label = "Apply update" }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { droneParams, setDroneParams } = useDroneParams();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<WriteChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  // Store the full target params so we can update droneParams fully on success.
  const [targetParams, setTargetParams] = useState<Map<string, number>>(new Map());

  async function handleClick() {
    if (!droneParams || droneParams.length === 0) {
      setError("No drone connected.");
      return;
    }
    setLoading(true);
    setError(null);

    // Fetch target version params (paginated)
    const supabase = createClient();
    if (!supabase) { setError("Supabase not configured."); setLoading(false); return; }

    const target = new Map<string, number>();
    for (let from = 0; ; from += 1000) {
      const { data, error: dbErr } = await supabase
        .from("param_values")
        .select("name, value")
        .eq("param_version_id", versionId)
        .range(from, from + 999);
      if (dbErr) { setError(dbErr.message); setLoading(false); return; }
      if (!data || data.length === 0) break;
      for (const { name, value } of data) target.set(name, parseFloat(value));
      if (data.length < 1000) break;
    }

    if (target.size === 0) { setError("Target version has no params."); setLoading(false); return; }

    // Diff: only params that differ between drone and target,
    // excluding runtime/read-only params that change automatically.
    const droneMap = new Map(droneParams.map((p) => [p.name, parseFloat(p.value)]));
    const diff: WriteChange[] = [];
    for (const [name, targetVal] of target.entries()) {
      if (RUNTIME_PARAMS.has(name)) continue;
      const droneVal = droneMap.get(name);
      if (droneVal === undefined || droneVal !== targetVal) {
        diff.push({ name, value: targetVal });
      }
    }

    if (diff.length === 0) {
      setError("Drone is already up to date.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setTargetParams(target);
    setChanges(diff);
  }

  function handleSuccess(_written: ParamWriteResult[]) {
    if (!droneParams) return;
    // Update droneParams to match the full target state so the match hook
    // re-evaluates to up_to_date. Don't rely only on written[] because
    // some writes may not be acknowledged even when successful.
    const updated = droneParams.map((p) => {
      const targetVal = targetParams.get(p.name);
      return targetVal !== undefined ? { ...p, value: String(targetVal) } : p;
    });
    setDroneParams(updated);
    setChanges(null);
    setUpdated(true);
    clearDroneMatchCache();
    startTransition(() => router.refresh());
  }

  // Hide immediately after a successful update — don't wait for the async
  // hook re-fetch to settle.
  if (updated) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !droneParams?.length}
        className={className ?? "btn-apply-update flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"}
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <ArrowUpCircle className="h-3.5 w-3.5" />
        }
        {loading ? "Loading…" : label}
      </button>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
      {changes && (
        <WriteDroneDialog
          changes={changes}
          onClose={() => setChanges(null)}
          onSuccess={handleSuccess}
          onStart={(addLog) => {
            const current = new Map(
              (droneParams ?? []).map((p) => [p.name, parseFloat(p.value)])
            );
            return flashParamsToDrone(targetParams, current, addLog);
          }}
        />
      )}
    </>
  );
}
