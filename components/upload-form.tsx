"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle } from "lucide-react";
import Link from "next/link";

type DroneType = { id: string; name: string };
type Firmware = { id: string; drone_type_id: string; version: string };
type ParamSetOption = { id: string; name: string; drone_type_id: string | null };

interface Props {
  droneTypes: DroneType[];
  firmwares: Firmware[];
  paramSets: ParamSetOption[];
}

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function UploadForm({ droneTypes, firmwares, paramSets }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [droneTypeId, setDroneTypeId] = useState("");
  const [firmwareId, setFirmwareId] = useState("");
  const [paramSetId, setParamSetId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ paramSetId: string } | null>(null);

  const filteredFirmwares = firmwares.filter((f) => f.drone_type_id === droneTypeId);
  const filteredParamSets = paramSets.filter((ps) => ps.drone_type_id === droneTypeId);

  function reset() {
    setVersionLabel("");
    setChangelog("");
    setFile(null);
    setError(null);
    setDone(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("droneTypeId", droneTypeId);
    if (firmwareId) fd.set("firmwareId", firmwareId);
    if (mode === "existing") fd.set("paramSetId", paramSetId);
    if (mode === "new") {
      fd.set("name", name);
      if (description) fd.set("description", description);
    }
    fd.set("versionLabel", versionLabel);
    if (changelog) fd.set("changelog", changelog);
    fd.set("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Upload failed");
      setSubmitting(false);
      return;
    }

    setDone({ paramSetId: json.paramSetId as string });
    setSubmitting(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Upload complete</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The param set has been saved to the catalog.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-secondary border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
          >
            Upload another
          </button>
          <Link
            href="/catalog"
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
      <h1 className="text-xl font-semibold text-foreground mb-6">Upload Param File</h1>

      {/* Mode toggle */}
      <div className="flex rounded-md border border-border overflow-hidden mb-6 w-fit text-sm">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-2 font-medium transition-colors cursor-pointer ${
              mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "new" ? "New param set" : "Add version to existing"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {/* Drone type */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            Drone type <span className="text-destructive">*</span>
          </span>
          <select
            required
            value={droneTypeId}
            onChange={(e) => {
              setDroneTypeId(e.target.value);
              setFirmwareId("");
              setParamSetId("");
            }}
            className={selectClass}
          >
            <option value="">Select drone type…</option>
            {droneTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>
        </label>

        {/* Firmware */}
        {droneTypeId && (
          <label className={labelClass}>
            <span className={labelTextClass}>Firmware version</span>
            <select value={firmwareId} onChange={(e) => setFirmwareId(e.target.value)} className={selectClass}>
              <option value="">None / Unknown</option>
              {filteredFirmwares.map((f) => (
                <option key={f.id} value={f.id}>
                  ArduPilot v{f.version}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* New: name + description */}
        {mode === "new" && (
          <>
            <label className={labelClass}>
              <span className={labelTextClass}>
                Param set name <span className="text-destructive">*</span>
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Baseline survey config"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (optional)"
                className={inputClass}
              />
            </label>
          </>
        )}

        {/* Existing: param set selector */}
        {mode === "existing" && droneTypeId && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              Param set <span className="text-destructive">*</span>
            </span>
            <select
              required
              value={paramSetId}
              onChange={(e) => setParamSetId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select param set…</option>
              {filteredParamSets.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {ps.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Version label */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            Version label <span className="text-destructive">*</span>
          </span>
          <input
            required
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder="e.g. v1.0"
            className={inputClass + " font-mono"}
          />
        </label>

        {/* Changelog */}
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

        {/* File */}
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

        {error && (
          <p className="text-xs text-destructive-foreground bg-destructive/30 border border-destructive/50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
