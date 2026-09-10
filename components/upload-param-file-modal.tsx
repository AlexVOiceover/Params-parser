"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, CheckCircle } from "lucide-react";
import { parseParamFile } from "@/lib/param-engine";
import type { FamilyOption, VariantOption } from "@/components/clients-table";

interface Props {
  clientId: string;
  clientName: string;
  families: FamilyOption[];
  variants: VariantOption[];
  /** Drones already registered to this client, to resolve a typed serial onto one. */
  drones: { id: string; serial: string; variant_id: string }[];
  onClose: () => void;
}

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function UploadParamFileModal({
  clientId,
  clientName,
  families,
  variants,
  drones,
  onClose,
}: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [serial, setSerial] = useState("");
  const [serialTouched, setSerialTouched] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [versionLabel, setVersionLabel] = useState("1");
  const [changelog, setChangelog] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const variantsForFamily = useMemo(
    () => variants.filter((v) => v.family_id === familyId),
    [variants, familyId]
  );

  // A typed serial may belong to a drone this client already has.
  const matchedDrone = useMemo(() => {
    const s = serial.trim().toLowerCase();
    if (!s) return null;
    return drones.find((d) => d.serial.toLowerCase() === s) ?? null;
  }, [drones, serial]);

  // Read SCR_USER1 out of the file to pre-fill the serial — files exported from
  // a configured drone carry its identity there.
  async function handleFileChange(next: File | null) {
    setFile(next);
    setError(null);
    if (!next) return;
    try {
      const text = await next.text();
      const scrUser1 = parseParamFile(text).find((p) => p.name === "SCR_USER1");
      const val = scrUser1 ? parseInt(scrUser1.value, 10) : NaN;
      if (Number.isFinite(val) && val > 0 && !serialTouched) {
        setSerial(String(val));
      }
    } catch {
      // Unreadable file — the serial just stays as typed.
    }
  }

  // When the serial matches a known drone, its variant is already settled.
  const effectiveVariantId = matchedDrone?.variant_id ?? variantId;
  const ready = !!file && !!serial.trim() && !!effectiveVariantId && /^\d+$/.test(versionLabel.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.set("mode", "new-drone");
    fd.set("clientId", clientId);
    fd.set("variantId", effectiveVariantId);
    fd.set("serial", serial.trim());
    fd.set("versionLabel", versionLabel.trim());
    if (changelog) fd.set("changelog", changelog);
    fd.set("file", file!);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const reader = res.body?.getReader();
    if (!reader) {
      setError("No response from server");
      setSubmitting(false);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finished = false;

    while (!finished) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.error) {
            setError(parsed.text ?? "Upload failed");
            setSubmitting(false);
            return;
          }
          if (parsed.done) {
            finished = true;
            break;
          }
        } catch {
          // ignore malformed line
        }
      }
    }

    setDone(true);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!submitting ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Upload param file</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center flex flex-col items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <p className="text-sm text-foreground font-medium">Param set uploaded</p>
            <p className="text-xs text-muted-foreground">
              {serial.trim()} is now registered to {clientName} with v{versionLabel.trim()}.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              For a param set received by email or another route, without connecting the drone.
              Uploading to <span className="text-foreground font-medium">{clientName}</span>.
            </p>

            {/* File first — the serial is read out of it */}
            <label className={labelClass} htmlFor="upf-file">
              <span className={labelTextClass}>
                .param file <span className="text-destructive">*</span>
              </span>
              <input
                id="upf-file"
                type="file"
                required
                accept=".param"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-2 file:py-1 file:text-xs file:text-primary file:cursor-pointer cursor-pointer"
              />
              {file && (
                <span className="text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </label>

            {/* Serial */}
            <label className={labelClass} htmlFor="upf-serial">
              <span className={labelTextClass}>
                Drone serial <span className="text-destructive">*</span>
              </span>
              <input
                id="upf-serial"
                required
                value={serial}
                onChange={(e) => { setSerial(e.target.value); setSerialTouched(true); }}
                placeholder="e.g. AIR4-0426-0023"
                className={inputClass + " font-mono"}
              />
              {matchedDrone ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Existing drone — new version will be added to it.
                </span>
              ) : serial.trim() ? (
                <span className="text-xs text-muted-foreground">
                  Not registered yet — it will be created for {clientName}.
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Pick the file above to read the serial from its SCR_USER1.
                </span>
              )}
            </label>

            {/* Family + Variant — only when the serial doesn't already settle it */}
            {!matchedDrone && (
              <>
                <label className={labelClass} htmlFor="upf-family">
                  <span className={labelTextClass}>
                    Family <span className="text-destructive">*</span>
                  </span>
                  <select
                    id="upf-family"
                    required
                    value={familyId}
                    onChange={(e) => { setFamilyId(e.target.value); setVariantId(""); }}
                    className={selectClass}
                  >
                    <option value="">Select family…</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>

                {familyId && (
                  <label className={labelClass} htmlFor="upf-variant">
                    <span className={labelTextClass}>
                      Variant <span className="text-destructive">*</span>
                    </span>
                    {variantsForFamily.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No variants for this family yet.
                      </p>
                    ) : (
                      <select
                        id="upf-variant"
                        required
                        value={variantId}
                        onChange={(e) => setVariantId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select variant…</option>
                        {variantsForFamily.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </label>
                )}
              </>
            )}

            {/* Version */}
            <label className={labelClass} htmlFor="upf-version">
              <span className={labelTextClass}>
                Version <span className="text-destructive">*</span>
              </span>
              <input
                id="upf-version"
                required
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g. 1"
                className={inputClass + " font-mono"}
              />
              {versionLabel.trim() && !/^\d+$/.test(versionLabel.trim()) && (
                <p className="text-xs text-destructive mt-0.5">Must be a whole number (e.g. 1)</p>
              )}
            </label>

            {/* Changelog */}
            <label className={labelClass} htmlFor="upf-changelog">
              <span className={labelTextClass}>Changelog</span>
              <textarea
                id="upf-changelog"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={2}
                placeholder="Where did this file come from? (optional)"
                className={inputClass + " resize-none"}
              />
            </label>

            {error && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ready || submitting}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                {submitting ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
