"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Upload, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ClientRow { id: string; name: string }
interface DroneRow { id: string; client_id: string; variant_id: string; serial: string }
interface FamilyRow { id: string; name: string }
interface VariantRow { id: string; name: string; family_id: string | null }
interface ClientSetRow { id: string; client_id: string | null; drone_id: string | null; variant_id: string }
interface VersionRow { client_set_id: string; version_label: string }

interface Props {
  content: string;
  suggestedName: string;
  onClose: () => void;
}

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function CatalogUploadModal({ content, suggestedName, onClose }: Props) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [drones, setDrones] = useState<DroneRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [clientSets, setClientSets] = useState<ClientSetRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [clientId, setClientId] = useState("");
  const [droneId, setDroneId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionTouched, setVersionTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("drones").select("id, client_id, variant_id, serial").order("serial"),
      supabase.from("families").select("id, name").order("name"),
      supabase.from("variants").select("id, name, family_id").order("name"),
      supabase.from("client_sets").select("id, client_id, drone_id, variant_id"),
      supabase.from("param_versions").select("client_set_id, version_label"),
    ]).then(([c, d, f, v, cs, vs]) => {
      setClients(c.data ?? []);
      setDrones(d.data ?? []);
      setFamilies(f.data ?? []);
      setVariants(v.data ?? []);
      setClientSets(cs.data ?? []);
      setVersions(vs.data ?? []);
      setLoaded(true);
    });
  }, []);

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const familyById = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  function variantLabel(variantId: string): string {
    const v = variantById.get(variantId);
    if (!v) return "?";
    const f = v.family_id ? familyById.get(v.family_id) : undefined;
    return `${f?.name ?? "?"} / ${v.name}`;
  }

  const dronesForClient = useMemo(
    () => drones.filter((d) => d.client_id === clientId),
    [drones, clientId]
  );

  const selectedDrone = useMemo(
    () => drones.find((d) => d.id === droneId) ?? null,
    [drones, droneId]
  );

  // Find existing client_set for this drone (matched on client + drone + variant).
  const existingClientSet = useMemo(() => {
    if (!selectedDrone) return null;
    return clientSets.find(
      (cs) =>
        cs.client_id === selectedDrone.client_id &&
        cs.drone_id === selectedDrone.id &&
        cs.variant_id === selectedDrone.variant_id
    ) ?? null;
  }, [clientSets, selectedDrone]);

  // Compute next major version for the selected drone's existing client_set.
  const nextMajor = useMemo(() => {
    if (!existingClientSet) return 1;
    let max = 0;
    for (const v of versions) {
      if (v.client_set_id !== existingClientSet.id) continue;
      const m = /^(\d+)\.\d+$/.exec(v.version_label);
      if (!m) continue;
      const major = parseInt(m[1], 10);
      if (major > max) max = major;
    }
    return max + 1;
  }, [versions, existingClientSet]);

  // Auto-fill version label whenever drone changes (unless user typed something).
  useEffect(() => {
    if (versionTouched) return;
    if (!selectedDrone) {
      setVersionLabel("");
      return;
    }
    setVersionLabel(`${nextMajor}.0`);
  }, [selectedDrone, nextMajor, versionTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDrone) return;
    if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
      setError("Version must be in format number.number (e.g. 1.0)");
      return;
    }
    setSubmitting(true);
    setError(null);

    const filename = suggestedName.endsWith(".param") ? suggestedName : `${suggestedName}.param`;
    const file = new File([content], filename, { type: "text/plain" });

    const fd = new FormData();
    if (existingClientSet) {
      fd.set("mode", "existing");
      fd.set("clientSetId", existingClientSet.id);
    } else {
      const client = clients.find((c) => c.id === clientId);
      fd.set("mode", "new-client-set");
      fd.set("variantId", selectedDrone.variant_id);
      fd.set("clientName", client?.name ?? "");
      fd.set("serial", selectedDrone.serial);
    }
    fd.set("versionLabel", versionLabel);
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
  }

  const submitDisabled =
    submitting ||
    !droneId ||
    !versionLabel.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Publish to Catalog</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center flex flex-col items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <p className="text-sm text-foreground font-medium">Published to catalog</p>
            <p className="text-xs text-muted-foreground">The version is now visible in the catalog.</p>
            <a
              href="/"
              className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline cursor-pointer"
            >
              Go to catalog <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
            {/* Client */}
            <label className={labelClass}>
              <span className={labelTextClass}>Client <span className="text-destructive">*</span></span>
              <select
                required
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setDroneId(""); setVersionTouched(false); }}
                className={selectClass}
                disabled={!loaded}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {/* Drone */}
            {clientId && (
              <label className={labelClass}>
                <span className={labelTextClass}>Drone <span className="text-destructive">*</span></span>
                {dronesForClient.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No drones registered for this client. Add one in <Link href="/admin/clients" className="text-primary hover:underline" onClick={onClose}>Clients</Link>.
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
                <span className={labelTextClass}>Version label <span className="text-destructive">*</span></span>
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

            {error && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Upload className="h-3.5 w-3.5" />
                {submitting ? "Publishing…" : "Publish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
