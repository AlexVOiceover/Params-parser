"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleSlash, GitCompareArrows, Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { Badge } from "@/components/status-badge";
import { buttonClass, cardClass } from "@/components/ui/styles";

export interface ReviewRow {
  id: string;
  label: string;
  createdAt: string;
  changelog: string | null;
  author: string | null;
  /** What the proposal is for. `model` is the whole name, product line included; null when it cannot be resolved. */
  subject:
    | { kind: "drone"; serial: string; client: string | null; model: string | null }
    | { kind: "template"; model: string | null };
  href: string;
  targetId: string | null;
  targetLabel: string | null;
  /** The newer version that was approved after this proposal; the server then refuses to approve it. */
  supersededBy: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ReviewQueue({ rows }: { rows: ReviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={`${cardClass} px-6 py-14 text-center`}>
        <p className="text-sm text-muted-foreground">Nothing to review.</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <ProposalCard row={row} />
        </li>
      ))}
    </ol>
  );
}

/**
 * One request for one proposal. It stays busy until the refreshed list has
 * arrived, so the button cannot be pressed again on a card that is about to go.
 */
function useProposalAction(id: string, method: "PATCH" | "DELETE", onStart: () => void, onError: (message: string) => void) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [sending, setSending] = useState(false);

  async function run(): Promise<boolean> {
    setSending(true);
    onStart();
    const res = await fetch(`/api/admin/param-versions/${id}`, { method }).catch(() => null);
    if (res?.ok) {
      startRefresh(() => router.refresh());
      setSending(false);
      return true;
    }
    const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string };
    setSending(false);
    onError(body.error ?? "That did not work");
    return false;
  }

  return { busy: sending || refreshing, run };
}

function ProposalCard({ row }: { row: ReviewRow }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const clearError = () => setError(null);
  const approve = useProposalAction(row.id, "PATCH", clearError, setError);
  const remove = useProposalAction(row.id, "DELETE", clearError, setError);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const questionId = useId();
  const { subject } = row;

  // The question replaces the buttons, so keyboard focus has to follow it there and back.
  useEffect(() => {
    if (confirming) keepButton.current?.focus();
    else if (wasConfirming.current) rejectButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  async function deleteProposal() {
    if (!(await remove.run())) setConfirming(false);
  }

  return (
    <article className={cardClass}>
      <div className="px-4 pb-3.5 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {subject.kind === "drone" ? (
              <>
                <Link href={row.href} className="font-mono text-base font-semibold text-foreground hover:text-primary hover:underline cursor-pointer">
                  {subject.serial}
                </Link>
                <span className={`text-sm font-medium ${subject.client ? "text-foreground" : "text-muted-foreground"}`}>
                  {subject.client ?? "No client"}
                </span>
              </>
            ) : (
              <>
                <Link href={row.href} className="text-base font-semibold text-foreground hover:text-primary hover:underline cursor-pointer">
                  {subject.model ?? "Model template"}
                </Link>
                {subject.model && <span className="text-sm font-normal text-muted-foreground">— model template</span>}
              </>
            )}
          </h2>
          {row.supersededBy && (
            <Badge tone="muted" title={`v${row.supersededBy} was approved after this proposal`}>
              <CircleSlash className="h-3 w-3" aria-hidden="true" />
              Superseded by v{row.supersededBy}
            </Badge>
          )}
          {subject.kind === "drone" && subject.model && (
            <span className="text-[13px] text-muted-foreground sm:ml-auto">{subject.model}</span>
          )}
        </div>

        <p className="mt-1.5 text-[13px] text-muted-foreground">
          <span className="font-mono text-sm font-semibold text-foreground">v{row.label}</span>
          {" · proposed"}
          {row.author && <> by <span className="font-medium text-foreground">{row.author}</span></>}
          {" · "}
          <time dateTime={row.createdAt} suppressHydrationWarning>{formatDate(row.createdAt)}</time>
        </p>

        {row.changelog && <p className="mt-2.5 whitespace-pre-wrap text-sm text-foreground">{row.changelog}</p>}

        {row.supersededBy && (
          <p className="mt-2.5 text-[13px] text-muted-foreground">
            v{row.supersededBy} was approved after this proposal, so it can no longer be approved. It can only be deleted.
          </p>
        )}
      </div>

      {confirming ? (
        <div
          role="group"
          aria-labelledby={questionId}
          onKeyDown={(e) => { if (e.key === "Escape" && !remove.busy) setConfirming(false); }}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-destructive/5 px-4 py-3 sm:px-5"
        >
          <p id={questionId} className="text-[13px] font-medium text-foreground">Delete this proposal? It cannot be undone.</p>
          <div className="ml-auto flex items-center gap-2">
            <BusyButton type="button" variant="danger" busy={remove.busy} busyLabel="Deleting…" onClick={deleteProposal}>
              Delete proposal
            </BusyButton>
            <button ref={keepButton} type="button" disabled={remove.busy} onClick={() => setConfirming(false)} className={buttonClass("secondary")}>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
          {!row.supersededBy && (
            <BusyButton
              type="button"
              variant="primary"
              busy={approve.busy}
              busyLabel="Approving…"
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={() => approve.run()}
            >
              Approve
            </BusyButton>
          )}
          {row.targetId && (
            <Link href={`/compare?v=${row.targetId}&v=${row.id}`} className={buttonClass("secondary")}>
              <GitCompareArrows className="h-3.5 w-3.5" /> Compare with v{row.targetLabel}
            </Link>
          )}
          <button
            ref={rejectButton}
            type="button"
            onClick={() => setConfirming(true)}
            className={buttonClass("dangerOutline", "sm", "ml-auto")}
          >
            <Trash2 className="h-3.5 w-3.5" /> {row.supersededBy ? "Delete" : "Reject"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="border-t border-border px-4 py-2.5 text-[13px] text-destructive sm:px-5">{error}</p>}
    </article>
  );
}
