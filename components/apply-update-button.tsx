"use client";

import { useState } from "react";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDroneParams } from "@/lib/drone-params-context";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
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
  const { droneParams, setDroneParams } = useDroneParams();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<WriteChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    // Diff: only params that differ between drone and target
    const droneMap = new Map(droneParams.map((p) => [p.name, parseFloat(p.value)]));
    const diff: WriteChange[] = [];
    for (const [name, targetVal] of target.entries()) {
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
    setChanges(diff);
  }

  function handleSuccess(written: ParamWriteResult[]) {
    if (!droneParams) return;
    const writtenMap = new Map(written.map((r) => [r.name, r.actual ?? r.requested]));
    const updated = droneParams.map((p) => {
      const v = writtenMap.get(p.name);
      return v !== undefined ? { ...p, value: String(v) } : p;
    });
    setDroneParams(updated);
    setChanges(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !droneParams?.length}
        className={className ?? "flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"}
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
        />
      )}
    </>
  );
}
