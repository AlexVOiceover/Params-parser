"use client";

import { useState, useEffect, useMemo, useId } from "react";
import { X, Upload, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useDroneParams } from "@/lib/drone-params-context";
import { droneHref } from "@/lib/versions";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { buttonClass, fieldClass, labelClass } from "@/components/ui/styles";

interface ClientRow { id: string; name: string }
interface DroneRow { id: string; client_id: string; variant_id: string; serial: string }
interface FamilyRow { id: string; slug: string; name: string }
interface VariantRow { id: string; name: string; family_id: string | null }
interface ClientSetRow { id: string; client_id: string | null; drone_id: string | null; variant_id: string }
interface VersionRow { client_set_id: string; version_label: string }

interface Props {
  content: string;
  suggestedName: string;
  onClose: () => void;
}

export function CatalogUploadModal({ content, suggestedName, onClose }: Props) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [drones, setDrones] = useState<DroneRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [clientSets, setClientSets] = useState<ClientSetRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { autopilot } = useDroneParams();
  const [clientId, setClientId] = useState("");
  const [droneId, setDroneId] = useState("");
  const [changelog, setChangelog] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [donePath, setDonePath] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const titleId = useId();
  const clientFieldId = useId();
  const droneFieldId = useId();
  const changelogFieldId = useId();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("drones").select("id, client_id, variant_id, serial").order("serial"),
      supabase.from("families").select("id, slug, name").order("name"),
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

  // Compute next version for the selected drone's existing client_set.
  const nextVersion = useMemo(() => {
    if (!existingClientSet) return 1;
    let max = 0;
    for (const v of versions) {
      if (v.client_set_id !== existingClientSet.id) continue;
      const n = parseInt(v.version_label, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
  }, [versions, existingClientSet]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDrone) return;
    setSubmitting(true);
    setError(null);

    // Every drone has its own history; start it if this one has none yet.
    let setId = existingClientSet?.id ?? null;
    if (!setId) {
      const client = clients.find((c) => c.id === clientId);
      const res = await fetch("/api/admin/client-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedDrone.variant_id,
          clientId,
          droneId: selectedDrone.id,
          clientName: client?.name ?? selectedDrone.serial,
          serial: selectedDrone.serial,
        }),
      });
      const body = await res.json().catch(() => ({})) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Could not start the drone's history");
        setSubmitting(false);
        return;
      }
      setId = body.id;
    }

    const filename = suggestedName.endsWith(".param") ? suggestedName : `${suggestedName}.param`;
    const fd = new FormData();
    fd.set("clientSetId", setId);
    fd.set("changelog", changelog.trim());
    fd.set("file", new File([content], filename, { type: "text/plain" }));
    if (autopilot?.firmware) fd.set("firmware", autopilot.firmware);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({})) as { label?: string; approved?: boolean; error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }
    setSavedAs(body.label ? `v${body.label}${body.approved ? "" : " (waiting for review)"}` : null);
    setDonePath(droneHref(selectedDrone.serial));
    setDone(true);
  }

  const submitDisabled =
    submitting ||
    !droneId ||
    !changelog.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold text-foreground">Publish to Catalog</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className={buttonClass("ghost", "icon", "-mr-1.5")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-1 text-sm font-medium text-foreground">Published to catalog</p>
            <p className="text-[13px] text-muted-foreground">Saved as {savedAs ?? "a new version"} in the drone&apos;s history.</p>
            <a
              href={donePath ?? "/"}
              className={buttonClass("secondary", "sm", "mt-3")}
            >
              {donePath ? "Open the drone" : "Go to drones"} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {/* Client */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={clientFieldId} className={labelClass}>Client <span className="text-destructive">*</span></label>
                <select
                  id={clientFieldId}
                  required
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setDroneId(""); }}
                  className={`${fieldClass} cursor-pointer`}
                  disabled={!loaded}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {!loaded && (
                  <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Spinner /> Loading clients and drones…
                  </p>
                )}
              </div>

              {/* Drone */}
              {clientId && (
                <div className="flex flex-col gap-1.5">
                  {dronesForClient.length === 0 ? (
                    <>
                      <span className={labelClass}>Drone <span className="text-destructive">*</span></span>
                      <p className="text-[13px] text-muted-foreground">
                        No drones registered for this client. Add one on the <Link href="/" className="text-primary hover:underline cursor-pointer" onClick={onClose}>Drones</Link> list.
                      </p>
                    </>
                  ) : (
                    <>
                      <label htmlFor={droneFieldId} className={labelClass}>Drone <span className="text-destructive">*</span></label>
                      <select
                        id={droneFieldId}
                        required
                        value={droneId}
                        onChange={(e) => setDroneId(e.target.value)}
                        className={`${fieldClass} cursor-pointer`}
                      >
                        <option value="">Select drone…</option>
                        {dronesForClient.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.serial} — {variantLabel(d.variant_id)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              {/* Changelog */}
              {droneId && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={changelogFieldId} className={labelClass}>What does this version change? <span className="text-destructive">*</span></label>
                  <input
                    id={changelogFieldId}
                    required
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    className={fieldClass}
                  />
                  <p className="text-xs text-muted-foreground">Saved as v{nextVersion} of {selectedDrone?.serial}.</p>
                </div>
              )}

              {error && (
                <p role="alert" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">
              <button type="button" onClick={onClose} className={buttonClass("secondary")}>
                Cancel
              </button>
              <BusyButton
                type="submit"
                variant="primary"
                busy={submitting}
                busyLabel="Publishing…"
                disabled={submitDisabled}
                icon={<Upload className="h-3.5 w-3.5" />}
              >
                Publish
              </BusyButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
