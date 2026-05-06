"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

type Client = { id: string; name: string };
type Drone = { id: string; client_id: string; variant_id: string; serial: string };
type Family = { id: string; slug: string; name: string };
type Variant = { id: string; name: string; family_id: string };
type ClientSet = {
  id: string;
  client_id: string;
  drone_id: string;
  variant_id: string;
  nextMajor: number;
};
type DefaultClientSet = {
  id: string;
  variant_id: string;
  nextMajor: number;
};

export interface UploadFormData {
  clients: Client[];
  drones: Drone[];
  families: Family[];
  variants: Variant[];
  clientSets: ClientSet[];
  defaultClientSets: DefaultClientSet[];
}

type UploadKind = "default" | "client";

interface Props {
  data: UploadFormData;
  role: "admin" | "contributor" | "client";
  userClientId: string | null;
}

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function UploadForm({ data, role, userClientId }: Props) {
  const router = useRouter();
  const isClient = role === "client";
  // Client users always upload as a client; the toggle is hidden for them.
  const [kind, setKind] = useState<UploadKind>(isClient ? "client" : "default");
  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  // Client users are locked to their own company.
  const [clientId, setClientId] = useState(isClient ? (userClientId ?? "") : "");
  const [droneId, setDroneId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionTouched, setVersionTouched] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [donePath, setDonePath] = useState<string | null>(null);

  const variantById = useMemo(() => new Map(data.variants.map((v) => [v.id, v])), [data.variants]);
  const familyById = useMemo(() => new Map(data.families.map((f) => [f.id, f])), [data.families]);
  function variantLabel(variantId: string): string {
    const v = variantById.get(variantId);
    if (!v) return "?";
    const f = familyById.get(v.family_id);
    return `${f?.name ?? "?"} / ${v.name}`;
  }

  const variantsForFamily = useMemo(
    () => data.variants.filter((v) => v.family_id === familyId),
    [data.variants, familyId]
  );

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

  // For Default mode — Default client_set already in the catalog for the picked variant, if any.
  const defaultClientSet = useMemo(() => {
    if (!variantId) return null;
    return data.defaultClientSets.find((cs) => cs.variant_id === variantId) ?? null;
  }, [data.defaultClientSets, variantId]);

  // Auto-suggest version label whenever selection changes (unless user typed their own).
  useEffect(() => {
    if (versionTouched) return;
    if (kind === "default") {
      if (!variantId) { setVersionLabel(""); return; }
      const next = defaultClientSet?.nextMajor ?? 1;
      setVersionLabel(String(next));
    } else {
      if (!selectedDrone) { setVersionLabel(""); return; }
      const next = existingClientSet?.nextMajor ?? 1;
      setVersionLabel(String(next));
    }
  }, [kind, variantId, defaultClientSet, selectedDrone, existingClientSet, versionTouched]);

  function reset() {
    setVersionLabel("");
    setVersionTouched(false);
    setChangelog("");
    setFile(null);
    setError(null);
    setDone(false);
    setDonePath(null);
  }

  function switchKind(next: UploadKind) {
    setKind(next);
    setFamilyId("");
    setVariantId("");
    setClientId("");
    setDroneId("");
    setVersionLabel("");
    setVersionTouched(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (kind === "default" && !variantId) return;
    if (kind === "client" && !selectedDrone) return;
    if (!/^\d+$/.test(versionLabel.trim())) {
      setError("Version must be a whole number (e.g. 1)");
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    if (kind === "default") {
      if (defaultClientSet) {
        fd.set("mode", "existing");
        fd.set("clientSetId", defaultClientSet.id);
      } else {
        fd.set("mode", "default");
        fd.set("variantId", variantId);
      }
    } else if (existingClientSet) {
      fd.set("mode", "existing");
      fd.set("clientSetId", existingClientSet.id);
    } else {
      // Brand new (client, drone) combination — let the API create the client_set inline.
      const client = data.clients.find((c) => c.id === clientId);
      fd.set("mode", "new-client-set");
      fd.set("variantId", selectedDrone!.variant_id);
      fd.set("clientId", clientId);
      fd.set("droneId", selectedDrone!.id);
      fd.set("clientName", client?.name ?? "");
      fd.set("serial", selectedDrone!.serial);
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

    // Build the deep link to the variant page (Default + all client sets).
    const targetVariantId = kind === "default" ? variantId : selectedDrone!.variant_id;
    const variant = variantById.get(targetVariantId);
    const family = variant?.family_id ? familyById.get(variant.family_id) : null;
    if (family && variant) {
      setDonePath(`/${family.slug}/${variant.id}`);
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
            href={donePath ?? "/"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            {donePath ? "Open variant" : "Go to catalog"}
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
        {/* Kind toggle — hidden for client users (they never upload Defaults) */}
        {!isClient && (
          <div className="flex flex-col gap-1.5">
            <span className={labelTextClass}>Param set type</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => switchKind("default")}
                className={`rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer whitespace-nowrap ${kind === "default" ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                Default (catalog)
              </button>
              <button
                type="button"
                onClick={() => switchKind("client")}
                className={`rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer whitespace-nowrap ${kind === "client" ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                Client param set
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {kind === "default"
                ? "The reference param set we ship to clients for a given family/variant."
                : "A param set tied to a specific client drone (received from a client or read from a drone)."}
            </p>
          </div>
        )}

        {/* Default mode: Family + Variant */}
        {kind === "default" && (
          <>
            <label className={labelClass}>
              <span className={labelTextClass}>
                Family <span className="text-destructive">*</span>
              </span>
              <select
                required
                value={familyId}
                onChange={(e) => { setFamilyId(e.target.value); setVariantId(""); setVersionTouched(false); }}
                className={selectClass}
              >
                <option value="">Select family…</option>
                {data.families.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>

            {familyId && (
              <label className={labelClass}>
                <span className={labelTextClass}>
                  Variant <span className="text-destructive">*</span>
                </span>
                {variantsForFamily.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No variants for this family yet.
                  </p>
                ) : (
                  <select
                    required
                    value={variantId}
                    onChange={(e) => { setVariantId(e.target.value); setVersionTouched(false); }}
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

        {/* Client mode: Client + Drone */}
        {kind === "client" && (
          <>
            <label className={labelClass}>
              <span className={labelTextClass}>
                Client <span className="text-destructive">*</span>
              </span>
              <select
                required
                value={clientId}
                disabled={isClient}
                onChange={(e) => { setClientId(e.target.value); setDroneId(""); setVersionTouched(false); }}
                className={selectClass + (isClient ? " opacity-60" : "")}
              >
                <option value="">Select client…</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

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
          </>
        )}

        {/* Version */}
        {((kind === "default" && variantId) || (kind === "client" && droneId)) && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              Version <span className="text-destructive">*</span>
            </span>
            <input
              required
              value={versionLabel}
              onChange={(e) => { setVersionLabel(e.target.value); setVersionTouched(true); }}
              placeholder="e.g. 1"
              className={inputClass + " font-mono"}
            />
            {versionLabel.trim() && !/^\d+$/.test(versionLabel.trim()) && (
              <p className="text-xs text-destructive mt-0.5">Must be a whole number (e.g. 1)</p>
            )}
          </label>
        )}

        {/* Changelog */}
        {((kind === "default" && variantId) || (kind === "client" && droneId)) && (
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
        {((kind === "default" && variantId) || (kind === "client" && droneId)) && (
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
          disabled={submitting || (kind === "client" ? !droneId : !variantId) || !versionLabel.trim() || !file}
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
