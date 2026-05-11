"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Trash2, Eye } from "lucide-react";

interface ReviewRow {
  id: string;
  versionLabel: string;
  createdAt: string;
  clientSetId: string;
  clientName: string;
  droneSerial: string;
}

interface Props {
  rows: ReviewRow[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ReviewQueue({ rows }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleAccept(id: string) {
    setBusy(id);
    setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/param-versions/${id}`, { method: "PATCH" });
    setBusy(null);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setErrors((e) => ({ ...e, [id]: body.error ?? "Accept failed" }));
    }
  }

  async function handleDiscard(id: string) {
    setBusy(id);
    setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/param-versions/${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setErrors((e) => ({ ...e, [id]: body.error ?? "Discard failed" }));
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No versions pending review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-amber-700/40 bg-amber-900/10 px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground font-mono">v{row.versionLabel}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-foreground">{row.clientName}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-mono text-muted-foreground">{row.droneSerial}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{formatDate(row.createdAt)}</span>
              {errors[row.id] && (
                <p className="text-xs text-destructive mt-1">{errors[row.id]}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/compare?v=${row.id}`}
                title="View params"
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Link>
              <button
                type="button"
                onClick={() => handleDiscard(row.id)}
                disabled={busy === row.id}
                title="Discard — permanently remove this version"
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary hover:bg-destructive/20 hover:border-destructive/50 hover:text-destructive px-2.5 py-1.5 text-xs text-muted-foreground transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard
              </button>
              <button
                type="button"
                onClick={() => handleAccept(row.id)}
                disabled={busy === row.id}
                title="Accept — publish this version to the catalog"
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 px-2.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
