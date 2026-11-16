"use client";

import { useId, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { ParamInfoHover } from "@/components/param-info-hover";
import { parseParamFile } from "@/lib/param-engine";
import { fetchVersionValues } from "@/lib/drone-flash-engine";
import { isRuntime, isUnmanaged, paramsEqual } from "@/lib/desired-state";

interface Props {
  setId: string | null;
  variantId: string;
  kind: "drone" | "model";
  target: { id: string; label: string } | null;
  nextLabel: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface Row { name: string; before: number | null; after: number | null; perDrone: boolean }

/**
 * A new version from a .param file: shows exactly what it changes against the
 * target before anything is saved. Replaces the upload page, the inline upload
 * form and the Filter tool's "publish to catalog".
 */
export function NewVersionDialog({ setId, variantId, kind, target, nextLabel, isAdmin, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [paramCount, setParamCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [firmware, setFirmware] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPerDrone, setShowPerDrone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), changelog: useId(), firmware: useId(), perDrone: useId() };

  async function pick(f: File | null) {
    if (!f) return;
    setFile(f);
    setError(null);
    setRows(null);
    setReading(true);
    try {
      const params = parseParamFile(await f.text());
      if (params.length === 0) { setError("No params found in that file."); setFile(null); return; }
      setParamCount(params.length);
      const after = new Map<string, number>();
      for (const p of params) {
        const v = parseFloat(p.value);
        if (Number.isFinite(v)) after.set(p.name, v);
      }
      const before = target ? await fetchVersionValues(target.id) : new Map<string, number>();
      const out: Row[] = [];
      for (const name of new Set([...before.keys(), ...after.keys()])) {
        if (isRuntime(name)) continue;
        const a = before.get(name) ?? null;
        const b = after.get(name) ?? null;
        if (a !== null && b !== null && paramsEqual(a, b)) continue;
        out.push({ name, before: a, after: b, perDrone: isUnmanaged(name) });
      }
      setRows(out.sort((x, y) => x.name.localeCompare(y.name)));
    } catch {
      setError("Could not read that file.");
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("changelog", changelog);
    if (firmware.trim()) fd.set("firmware", firmware.trim());
    if (setId) fd.set("clientSetId", setId);
    else fd.set("variantId", variantId);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!res.ok) { setError(body.error ?? "Could not save the version"); return; }
    onSaved();
  }

  const managed = rows?.filter((r) => !r.perDrone) ?? [];
  const perDrone = rows?.filter((r) => r.perDrone) ?? [];
  const shown = showPerDrone ? rows ?? [] : managed;
  const fwInvalid = !!firmware.trim() && !/^\d+\.\d+\.\d+$/.test(firmware.trim());
  const field = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            New version <span className="font-mono">v{nextLabel}</span> from a file
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor={ids.file} className="sr-only">.param file</label>
            <input id={ids.file} ref={inputRef} type="file" accept=".param,.parm,.txt" className="hidden" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
            >
              <FileUp className="h-3.5 w-3.5" /> {file ? "Choose another file" : "Choose a .param file"}
            </button>
            {file && <span className="font-mono text-xs text-muted-foreground truncate">{file.name} · {paramCount} params</span>}
            {reading && <Spinner />}
          </div>

          {rows && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">
                {target
                  ? managed.length === 0
                    ? `Same managed params as v${target.label}.`
                    : `${managed.length} param${managed.length === 1 ? "" : "s"} differ from v${target.label}.`
                  : `${paramCount} params. This will be the first version.`}
                {perDrone.length > 0 && (
                  <span className="text-muted-foreground"> {perDrone.length} per-drone param{perDrone.length === 1 ? "" : "s"} also differ; they are stored but never installed.</span>
                )}
              </p>
              {target && (managed.length > 0 || perDrone.length > 0) && (
                <>
                  {perDrone.length > 0 && (
                    <div className="flex items-center gap-2">
                      <input id={ids.perDrone} type="checkbox" checked={showPerDrone} onChange={(e) => setShowPerDrone(e.target.checked)} className="cursor-pointer" />
                      <label htmlFor={ids.perDrone} className="text-xs text-muted-foreground cursor-pointer">Show per-drone params too</label>
                    </div>
                  )}
                  <div className="max-h-64 overflow-auto rounded-md border border-border">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="sticky top-0 bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-semibold text-foreground">Param</th>
                          <th className="px-3 py-1.5 text-left font-semibold">v{target.label} now</th>
                          <th className="px-3 py-1.5 text-left font-semibold">In the file</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {shown.map((r) => (
                          <tr key={r.name} className={r.perDrone ? "text-muted-foreground" : ""}>
                            <td className="px-3 py-1"><ParamInfoHover name={r.name} />{r.perDrone && <span className="ml-1.5 font-sans text-[10px]">per-drone</span>}</td>
                            <td className="px-3 py-1">{r.before ?? <span className="font-sans italic">not set</span>}</td>
                            <td className="px-3 py-1 text-foreground">{r.after ?? <span className="font-sans italic text-muted-foreground">not in file</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.changelog} className="text-xs font-medium text-muted-foreground">What does this version change? *</label>
            <textarea id={ids.changelog} rows={2} value={changelog} onChange={(e) => setChangelog(e.target.value)} disabled={saving} className={`${field} resize-none`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.firmware} className="text-xs font-medium text-muted-foreground">ArduPilot firmware it was made for (optional)</label>
            <input id={ids.firmware} value={firmware} onChange={(e) => setFirmware(e.target.value)} disabled={saving} placeholder="4.5.7" className={`${field} font-mono`} />
            {fwInvalid && <span className="text-xs text-destructive">Use the form 4.5.7</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? kind === "drone"
                ? `v${nextLabel} becomes the target: the drone is offered it the next time it is connected.`
                : `v${nextLabel} becomes the template new drones of this model start from.`
              : `v${nextLabel} waits for an admin to approve it.`}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
          <BusyButton
            type="button"
            busy={saving}
            busyLabel="Saving…"
            disabled={!file || !rows || !changelog.trim() || fwInvalid}
            onClick={save}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save as v{nextLabel}
          </BusyButton>
        </div>
      </div>
    </div>
  );
}
