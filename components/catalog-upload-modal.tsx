"use client";

import { useState, useEffect } from "react";
import { X, Upload, CheckCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface DroneType { id: string; name: string }

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
  const [droneTypes, setDroneTypes] = useState<DroneType[]>([]);
  const [droneTypeId, setDroneTypeId] = useState("");
  const [name, setName] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient().from("drone_types").select("id, name").order("name").then(({ data }) => {
      setDroneTypes(data ?? []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const filename = suggestedName.endsWith(".param") ? suggestedName : `${suggestedName}.param`;
    const file = new File([content], filename, { type: "text/plain" });

    const fd = new FormData();
    fd.set("mode", "new");
    fd.set("droneTypeId", droneTypeId);
    fd.set("name", name);
    fd.set("versionLabel", versionLabel);
    fd.set("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Upload failed");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
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
            <p className="text-xs text-muted-foreground">The param set is now visible in the catalog.</p>
            <a
              href="/catalog"
              className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline cursor-pointer"
            >
              Go to catalog <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
            <label className={labelClass}>
              <span className={labelTextClass}>Drone type <span className="text-destructive">*</span></span>
              <select required value={droneTypeId} onChange={(e) => setDroneTypeId(e.target.value)} className={selectClass}>
                <option value="">Select drone type…</option>
                {droneTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              <span className={labelTextClass}>Param set name <span className="text-destructive">*</span></span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Baseline survey config"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span className={labelTextClass}>Version label <span className="text-destructive">*</span></span>
              <input
                required
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g. v1.0"
                className={inputClass + " font-mono"}
              />
            </label>

            {error && (
              <p className="text-xs text-destructive-foreground bg-destructive/30 border border-destructive/50 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
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
