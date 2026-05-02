"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Upload, CheckCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FamilyRow { id: string; name: string }
interface VariantRow { id: string; name: string; family_id: string | null }
interface ClientSetRow { id: string; client_name: string; serial: string; variant_id: string }

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

const CLIENT_DATALIST_ID = "catalog-upload-modal-clients";

export function CatalogUploadModal({ content, suggestedName, onClose }: Props) {
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [clientSets, setClientSets] = useState<ClientSetRow[]>([]);

  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [clientName, setClientName] = useState("");
  const [serial, setSerial] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("families").select("id, name").order("name"),
      supabase.from("variants").select("id, name, family_id").order("name"),
      supabase.from("client_sets").select("id, client_name, serial, variant_id").order("client_name"),
    ]).then(([f, v, c]) => {
      setFamilies(f.data ?? []);
      setVariants(v.data ?? []);
      setClientSets(c.data ?? []);
    });
  }, []);

  const filteredVariants = variants.filter((v) => v.family_id === familyId);

  // Client-name suggestions: distinct client_names already used on this variant
  const clientNameSuggestions = useMemo(() => {
    if (!variantId) return [];
    const set = new Set(
      clientSets.filter((c) => c.variant_id === variantId).map((c) => c.client_name)
    );
    return [...set].sort();
  }, [clientSets, variantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
      setError("Version must be in format number.number (e.g. 1.0)");
      return;
    }
    setSubmitting(true);
    setError(null);

    const filename = suggestedName.endsWith(".param") ? suggestedName : `${suggestedName}.param`;
    const file = new File([content], filename, { type: "text/plain" });

    // Look up an existing (client_name, serial) in this variant — append a version to it if found.
    const existing = clientSets.find(
      (c) => c.variant_id === variantId && c.client_name === clientName.trim() && c.serial === serial.trim()
    );

    const fd = new FormData();
    if (existing) {
      fd.set("mode", "existing");
      fd.set("clientSetId", existing.id);
    } else {
      fd.set("mode", "new-client-set");
      fd.set("variantId", variantId);
      fd.set("clientName", clientName.trim());
      fd.set("serial", serial.trim());
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
    !familyId ||
    !variantId ||
    !clientName.trim() ||
    !serial.trim() ||
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
            <datalist id={CLIENT_DATALIST_ID}>
              {clientNameSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>

            {/* Family */}
            <label className={labelClass}>
              <span className={labelTextClass}>Family <span className="text-destructive">*</span></span>
              <select
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

            {/* Variant */}
            {familyId && (
              <label className={labelClass}>
                <span className={labelTextClass}>Variant <span className="text-destructive">*</span></span>
                <select
                  required
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select variant…</option>
                  {filteredVariants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Client */}
            {variantId && (
              <label className={labelClass}>
                <span className={labelTextClass}>Client <span className="text-destructive">*</span></span>
                <input
                  required
                  list={CLIENT_DATALIST_ID}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputClass}
                />
              </label>
            )}

            {/* Serial */}
            {variantId && (
              <label className={labelClass}>
                <span className={labelTextClass}>Serial <span className="text-destructive">*</span></span>
                <input
                  required
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="e.g. SN-12345"
                  className={inputClass + " font-mono"}
                />
              </label>
            )}

            {/* Version label */}
            <label className={labelClass}>
              <span className={labelTextClass}>Version label <span className="text-destructive">*</span></span>
              <input
                required
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g. 1.0"
                className={inputClass + " font-mono"}
              />
              {versionLabel.trim() && !/^\d+\.\d+$/.test(versionLabel.trim()) && (
                <p className="text-xs text-destructive mt-0.5">Must be number.number (e.g. 1.0)</p>
              )}
            </label>

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
