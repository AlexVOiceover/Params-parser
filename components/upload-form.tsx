"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

type Client = { id: string; name: string };
type Drone = { id: string; client_id: string; variant_id: string; serial: string };
type Family = { id: string; name: string };
type Variant = { id: string; name: string; family_id: string };
type ClientSet = {
  id: string;
  client_id: string;
  drone_id: string;
  variant_id: string;
  nextMajor: number;
};

export interface UploadFormData {
  clients: Client[];
  drones: Drone[];
  families: Family[];
  variants: Variant[];
  clientSets: ClientSet[];
}

interface Props {
  data: UploadFormData;
}

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function UploadForm({ data }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [droneId, setDroneId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionTouched, setVersionTouched] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const variantById = useMemo(() => new Map(data.variants.map((v) => [v.id, v])), [data.variants]);
  const familyById = useMemo(() => new Map(data.families.map((f) => [f.id, f])), [data.families]);
  function variantLabel(variantId: string): string {
    const v = variantById.get(variantId);
    if (!v) return "?";
    const f = familyById.get(v.family_id);
    return `${f?.name ?? "?"} / ${v.name}`;
  }

  const dronesForClient = useMemo(
    () => data.drones.filter((d) => d.client_id === clientId),
    [data.drones, clientId]
  );

  const selectedDrone = useMemo(
    () => data.drones.find((d) => d.id === droneId) ?? null,
    [data.drones, droneId]
  );

  // Find the existing client_set for the picked drone, if any.
  const existingClientSet = useMemo(() => {
    if (!selectedDrone) return null;
    return data.clientSets.find(
      (cs) =>
        cs.client_id === selectedDrone.client_id &&
        cs.drone_id === selectedDrone.id &&
        cs.variant_id === selectedDrone.variant_id
    ) ?? null;
  }, [data.clientSets, selectedDrone]);

  // Auto-suggest version label whenever the picked drone changes (unless user typed their own).
  useEffect(() => {
    if (versionTouched) return;
    if (!selectedDrone) {
      setVersionLabel("");
      return;
    }
    const next = existingClientSet?.nextMajor ?? 1;
    setVersionLabel(`${next}.0`);
  }, [selectedDrone, existingClientSet, versionTouched]);

  function reset() {
    setVersionLabel("");
    setVersionTouched(false);
    setChangelog("");
    setFile(null);
    setError(null);
    setDone(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedDrone) return;
    if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
      setError("Version must be in format number.number (e.g. 1.0)");
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    if (existingClientSet) {
      fd.set("mode", "existing");
      fd.set("clientSetId", existingClientSet.id);
    } else {
      // Brand new (client, drone) combination — let the API create the client_set inline.
      const client = data.clients.find((c) => c.id === clientId);
      fd.set("mode", "new-client-set");
      fd.set("variantId", selectedDrone.variant_id);
      fd.set("clientName", client?.name ?? "");
      fd.set("serial", selectedDrone.serial);
    }
    fd.set("versionLabel", versionLabel);
    if (changelog) fd.set("changelog", changelog);
    fd.set("file", file);

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

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Upload complete</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The version has been saved to the catalog.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-secondary border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
          >
            Upload another
          </button>
          <Link
            href="/"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Go to catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Upload</span>
      </nav>
      <h1 className="text-xl font-semibold text-foreground mb-6">Upload param file</h1>

      <div className="flex flex-col gap-4">
        {/* Client */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            Client <span className="text-destructive">*</span>
          </span>
          <select
            required
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setDroneId(""); setVersionTouched(false); }}
            className={selectClass}
          >
            <option value="">Select client…</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* Drone (serial — family / variant) */}
        {clientId && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              Drone <span className="text-destructive">*</span>
            </span>
            {dronesForClient.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No drones registered for this client. Add one in <Link href="/admin/clients" className="text-primary hover:underline">Clients</Link>.
              </p>
            ) : (
              <select
                required
                value={droneId}
                onChange={(e) => { setDroneId(e.target.value); setVersionTouched(false); }}
                className={selectClass}
              >
                <option value="">Select drone…</option>
                {dronesForClient.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.serial} — {variantLabel(d.variant_id)}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        {/* Version */}
        {droneId && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              Version <span className="text-destructive">*</span>
            </span>
            <input
              required
              value={versionLabel}
              onChange={(e) => { setVersionLabel(e.target.value); setVersionTouched(true); }}
              placeholder="e.g. 1.0"
              className={inputClass + " font-mono"}
            />
            {versionLabel.trim() && !/^\d+\.\d+$/.test(versionLabel.trim()) && (
              <p className="text-xs text-destructive mt-0.5">Must be number.number (e.g. 1.0)</p>
            )}
          </label>
        )}

        {/* Changelog */}
        {droneId && (
          <label className={labelClass}>
            <span className={labelTextClass}>Changelog</span>
            <textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              placeholder="What changed in this version? (optional)"
              className={inputClass + " resize-none"}
            />
          </label>
        )}

        {/* File */}
        {droneId && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              .param file <span className="text-destructive">*</span>
            </span>
            <input
              type="file"
              required
              accept=".param"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-2 file:py-1 file:text-xs file:text-primary file:cursor-pointer cursor-pointer"
            />
            {file && (
              <span className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </label>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !droneId || !versionLabel.trim() || !file}
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
