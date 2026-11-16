"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, GitCompareArrows, Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";

export interface ReviewRow {
  id: string;
  label: string;
  createdAt: string;
  changelog: string | null;
  author: string | null;
  /** Drone serial, or "<variant> template". */
  subject: string;
  href: string;
  targetId: string | null;
  targetLabel: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ReviewQueue({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function act(id: string, method: "PATCH" | "DELETE") {
    setBusy(`${method}-${id}`);
    setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/param-versions/${id}`, { method });
    setBusy(null);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setErrors((e) => ({ ...e, [id]: body.error ?? "That did not work" }));
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Nothing to review.</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-lg border border-sky-500/40 bg-card px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={row.href} className="font-mono text-sm font-semibold text-foreground hover:text-primary cursor-pointer">{row.subject}</Link>
            <span className="font-mono text-sm text-foreground">v{row.label}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(row.createdAt)}{row.author && <> · {row.author}</>}
            </span>
          </div>
          {row.changelog && <p className="text-sm text-foreground whitespace-pre-wrap">{row.changelog}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            <BusyButton
              type="button"
              busy={busy === `PATCH-${row.id}`}
              busyLabel="Approving…"
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={() => act(row.id, "PATCH")}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Approve
            </BusyButton>
            {row.targetId && (
              <Link
                href={`/compare?v=${row.targetId}&v=${row.id}`}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
              >
                <GitCompareArrows className="h-3.5 w-3.5" /> Compare with v{row.targetLabel}
              </Link>
            )}
            <BusyButton
              type="button"
              busy={busy === `DELETE-${row.id}`}
              busyLabel="Rejecting…"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => act(row.id, "DELETE")}
              className="ml-auto rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50"
            >
              Reject
            </BusyButton>
          </div>
          {errors[row.id] && <p className="text-xs text-destructive">{errors[row.id]}</p>}
        </li>
      ))}
    </ol>
  );
}
