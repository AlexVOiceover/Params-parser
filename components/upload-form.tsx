"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

type Family = { id: string; name: string };
type VariantOption = { id: string; name: string; family_id: string | null };
type ClientSetOption = { id: string; name: string; variant_id: string };

interface Props {
  families: Family[];
  variants: VariantOption[];
  clientSets: ClientSetOption[];
}

const NEW_CLIENT_SET = "__new__";

const inputClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function UploadForm({ families, variants, clientSets }: Props) {
  const router = useRouter();
  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [clientSetId, setClientSetId] = useState("");
  const [newClientSetName, setNewClientSetName] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const filteredVariants = variants.filter((v) => v.family_id === familyId);
  const filteredClientSets = clientSets.filter((c) => c.variant_id === variantId);
  const isNewClientSet = clientSetId === NEW_CLIENT_SET;

  function reset() {
    setVersionLabel("");
    setChangelog("");
    setFile(null);
    setError(null);
    setDone(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
      setError("Version must be in format number.number (e.g. 1.0)");
      return;
    }
    if (isNewClientSet && !newClientSetName.trim()) {
      setError("Client set name is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    if (isNewClientSet) {
      fd.set("mode", "new-client-set");
      fd.set("variantId", variantId);
      fd.set("name", newClientSetName.trim());
    } else {
      fd.set("mode", "existing");
      fd.set("clientSetId", clientSetId);
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
        {/* Family */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            Family <span className="text-destructive">*</span>
          </span>
          <select
            required
            value={familyId}
            onChange={(e) => { setFamilyId(e.target.value); setVariantId(""); setClientSetId(""); }}
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
            <span className={labelTextClass}>
              Variant <span className="text-destructive">*</span>
            </span>
            <select
              required
              value={variantId}
              onChange={(e) => { setVariantId(e.target.value); setClientSetId(""); }}
              className={selectClass}
            >
              <option value="">Select variant…</option>
              {filteredVariants.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* Client set */}
        {variantId && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              Client set <span className="text-destructive">*</span>
            </span>
            <select
              required
              value={clientSetId}
              onChange={(e) => setClientSetId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select client set…</option>
              {filteredClientSets.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_CLIENT_SET}>＋ Create new client set…</option>
            </select>
          </label>
        )}

        {/* New client-set name (when "Create new" is selected) */}
        {isNewClientSet && (
          <label className={labelClass}>
            <span className={labelTextClass}>
              New client set name <span className="text-destructive">*</span>
            </span>
            <input
              required
              value={newClientSetName}
              onChange={(e) => setNewClientSetName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className={inputClass}
            />
          </label>
        )}

        {/* Version */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            Version <span className="text-destructive">*</span>
          </span>
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
          <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
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
