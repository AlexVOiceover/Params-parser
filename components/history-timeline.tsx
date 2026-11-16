"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle, Check, ChevronDown, Columns2, Copy, Filter, Download, FileUp, GitCompareArrows, Link2, RotateCcw, Trash2, Unlink, Usb, X,
} from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { Badge } from "@/components/status-badge";
import { DroneGhostCard } from "@/components/drone-ghost-card";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { NewVersionDialog } from "@/components/new-version-dialog";
import { CopyVersionDialog } from "@/components/copy-version-dialog";
import { useConnectedDroneMatch, refreshDroneMatch } from "@/lib/use-connected-drone-match";
import { latestApproved, pendingProposal, nextLabel } from "@/lib/versions";
import type { TimelineEvent, TimelineVersion } from "@/lib/history";

interface Props {
  kind: "drone" | "model";
  /** The history's set; null for a model whose template has no version yet. */
  setId: string | null;
  variantId: string;
  versions: TimelineVersion[];
  events: TimelineEvent[];
  drone: { id: string; chipId: string | null; serial: string } | null;
  isAdmin: boolean;
  isStaff: boolean;
  /** Prefix for downloaded file names, e.g. the serial. */
  fileBase: string;
  /** Labels the Filter tool shows for where a version came from. */
  filterSource: { family: string; variant: string; client: string };
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const METHOD_TEXT: Record<string, string> = {
  connect: "at connect",
  messages_line: "from a Mission Planner Messages line",
  assembly: "at assembly",
};

export function HistoryTimeline({ kind, setId, variantId, versions, events, drone, isAdmin, isStaff, fileBase, filterSource }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const match = useConnectedDroneMatch();
  const [newOpen, setNewOpen] = useState(false);
  const [restoreOf, setRestoreOf] = useState<TimelineVersion | null>(null);
  const [copyOf, setCopyOf] = useState<TimelineVersion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparing, setComparing] = useState<string[] | null>(null);

  const target = latestApproved(versions.map((v) => ({ ...v, version_label: v.label, needs_review: v.needsReview })));
  const proposal = pendingProposal(versions.map((v) => ({ ...v, version_label: v.label, needs_review: v.needsReview })));
  const next = nextLabel(versions.map((v) => ({ version_label: v.label })));

  const connectedHere = kind === "drone" && match.status === "linked" && !!drone && match.drone?.id === drone.id;
  const onDroneId = !connectedHere ? null
    : match.state === "in_sync" ? match.desired?.id ?? null
    : match.state === "update_available" ? match.lastVerified?.id ?? null
    : match.state === "pending_review" ? match.pending?.id ?? null
    : null;

  const refresh = () => { refreshDroneMatch(); startTransition(() => router.refresh()); };

  // Versions and log entries in one chronological list.
  type Item = { at: string; version?: TimelineVersion; event?: TimelineEvent };
  const items: Item[] = [
    ...versions.map((v) => ({ at: v.createdAt, version: v })),
    // A capture is shown on the version it created, not as a separate line.
    ...events.filter((e) => e.kind !== "captured").map((e) => ({ at: e.createdAt, event: e })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const capturedIds = new Set(events.filter((e) => e.kind === "captured").map((e) => e.versionId));
  const canCreate = isStaff;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</h2>
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            comparing ? (
              <>
                <span className="text-xs text-muted-foreground">Pick two versions</span>
                <button
                  type="button"
                  onClick={() => setComparing(null)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setComparing([])}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
              >
                <GitCompareArrows className="h-3.5 w-3.5" /> Compare versions
              </button>
            )
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
            >
              <FileUp className="h-3.5 w-3.5" /> New version from file
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-foreground">
          {notice}
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-3.5 w-3.5" /></button>
        </p>
      )}

      {kind === "drone" && drone && (
        <DroneGhostCard
          droneId={drone.id}
          droneChipId={drone.chipId}
          droneSerial={drone.serial}
          nextLabel={next}
          onChanged={refresh}
        />
      )}

      {versions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-foreground">No versions yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kind === "drone"
              ? "Connect the drone to save what is on it, or upload a file."
              : "Upload the model's reference .param file to make it the template new drones start from."}
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {items.map((item) => item.version ? (
          <VersionCard
            key={item.version.id}
            v={item.version}
            isTarget={target?.id === item.version.id}
            isProposal={proposal?.id === item.version.id || item.version.needsReview}
            superseded={item.version.needsReview && proposal?.id !== item.version.id}
            onDrone={onDroneId === item.version.id}
            captured={capturedIds.has(item.version.id)}
            installable={connectedHere && target?.id === item.version.id && onDroneId !== item.version.id}
            canRestore={!item.version.needsReview && target?.id !== item.version.id && (isStaff || kind === "drone")}
            isAdmin={isAdmin}
            kind={kind}
            fileBase={fileBase}
            filterSource={filterSource}
            comparing={comparing}
            onToggleCompare={(id) => {
              const prev = comparing ?? [];
              const picked = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
              setComparing(picked);
              if (picked.length === 2) router.push(`/compare?v=${picked[0]}&v=${picked[1]}`);
            }}
            onRestore={() => setRestoreOf(item.version!)}
            onCopy={isStaff ? () => setCopyOf(item.version!) : undefined}
            onChanged={refresh}
          />
        ) : (
          <EventRow key={item.event!.id} e={item.event!} />
        ))}
      </ol>

      {newOpen && (
        <NewVersionDialog
          setId={setId}
          variantId={variantId}
          kind={kind}
          target={target ? { id: target.id, label: target.label } : null}
          nextLabel={next}
          isAdmin={isAdmin}
          onClose={() => setNewOpen(false)}
          onSaved={() => { setNewOpen(false); refresh(); }}
        />
      )}
      {copyOf && (
        <CopyVersionDialog
          versionId={copyOf.id}
          label={copyOf.label}
          isAdmin={isAdmin}
          onClose={() => setCopyOf(null)}
          onCopied={(msg) => { setCopyOf(null); setNotice(msg); }}
        />
      )}
      {restoreOf && (
        <RestoreDialog
          v={restoreOf}
          nextLabel={next}
          isAdmin={isAdmin}
          onClose={() => setRestoreOf(null)}
          onSaved={() => { setRestoreOf(null); refresh(); }}
        />
      )}
    </section>
  );
}

function VersionCard({
  v, isTarget, isProposal, superseded, onDrone, captured, installable, canRestore, isAdmin, kind, fileBase, filterSource,
  comparing, onToggleCompare, onRestore, onCopy, onChanged,
}: {
  v: TimelineVersion;
  isTarget: boolean;
  isProposal: boolean;
  superseded: boolean;
  onDrone: boolean;
  captured: boolean;
  installable: boolean;
  canRestore: boolean;
  isAdmin: boolean;
  kind: "drone" | "model";
  fileBase: string;
  filterSource: { family: string; variant: string; client: string };
  comparing: string[] | null;
  onToggleCompare: (id: string) => void;
  onRestore: () => void;
  onCopy?: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = comparing?.includes(v.id) ?? false;

  async function act(kindOfAct: "approve" | "delete") {
    setBusy(kindOfAct);
    setError(null);
    const res = await fetch(`/api/admin/param-versions/${v.id}`, { method: kindOfAct === "approve" ? "PATCH" : "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "That did not work");
      setConfirmDelete(false);
      return;
    }
    onChanged();
  }

  return (
    <li
      className={`rounded-lg border bg-card px-4 py-3 ${
        isTarget ? "border-primary/50 ring-1 ring-primary/20" : isProposal ? "border-sky-500/40" : "border-border"
      } ${selected ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        {comparing && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleCompare(v.id)}
            aria-label={`Compare v${v.label}`}
            className="mt-1 cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-semibold text-foreground">v{v.label}</span>
            {isTarget && (
              <Badge tone="ok" title={kind === "drone" ? "The version this drone should be on" : "New drones of this model start from it"}>
                {kind === "drone" ? "Target" : "Current template"}
              </Badge>
            )}
            {isProposal && !superseded && <Badge tone="info" title="Waiting for an admin to approve it">Proposed · waiting for review</Badge>}
            {superseded && <Badge tone="muted" title="A newer version was approved after it">Proposal not taken</Badge>}
            {onDrone && <Badge tone="ok"><Usb className="h-2.5 w-2.5" /> On the connected drone</Badge>}
            <span className="text-xs text-muted-foreground">
              {when(v.createdAt)}
              {v.author && <> · {v.author}</>}
              {captured && <> · saved from the drone</>}
            </span>
          </div>
          {v.changelog && <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{v.changelog}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {v.changes === null ? "First version" : v.changes === 0 ? "Same params as the previous version" : `${v.changes} param${v.changes === 1 ? "" : "s"} changed`}
            {" · "}
            <span className="font-mono">{v.firmware ? `ArduPilot ${v.firmware}` : "firmware not recorded"}</span>
          </p>

          {!comparing && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {installable && (
                <ApplyUpdateButton version={{ id: v.id, label: v.label, firmware: v.firmware }} label={`Install v${v.label} on the drone`} />
              )}
              {isAdmin && isProposal && !superseded && (
                <BusyButton
                  type="button"
                  busy={busy === "approve"}
                  busyLabel="Approving…"
                  icon={<Check className="h-3.5 w-3.5" />}
                  onClick={() => act("approve")}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Approve as {kind === "drone" ? "target" : "template"}
                </BusyButton>
              )}
              <DownloadMenu versionId={v.id} fileName={`${fileBase}-v${v.label}`} />
              {v.prevId && (
                <Link
                  href={`/compare?v=${v.prevId}&v=${v.id}`}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" /> What changed
                </Link>
              )}
              <Link
                href={`/compare?pick=${v.id}`}
                title="Compare with any other version, drone, model template or a file"
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
              >
                <Columns2 className="h-3.5 w-3.5" /> Compare with…
              </Link>
              <Link
                href={`/filter?versionId=${v.id}&family=${encodeURIComponent(filterSource.family)}&variant=${encodeURIComponent(filterSource.variant)}&client=${encodeURIComponent(filterSource.client)}&version=${encodeURIComponent(v.label)}`}
                className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
              >
                <Filter className="h-3.5 w-3.5" /> Open in Filter
              </Link>
              {onCopy && (
                <button
                  type="button"
                  onClick={onCopy}
                  title="Save a copy as the next version of another drone or a model template"
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy to…
                </button>
              )}
              {canRestore && (
                <button
                  type="button"
                  onClick={onRestore}
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              )}
              {isAdmin && (
                confirmDelete ? (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Delete v{v.label}?</span>
                    <BusyButton
                      type="button"
                      busy={busy === "delete"}
                      busyLabel="Deleting…"
                      onClick={() => act("delete")}
                      className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-white hover:bg-destructive/90"
                    >
                      Delete
                    </BusyButton>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={`Delete v${v.label}`}
                    title={isProposal ? "Reject and delete this proposal" : "Delete this version"}
                    className="ml-auto rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          )}
          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </li>
  );
}

function EventRow({ e }: { e: TimelineEvent }) {
  const v = e.label ? `v${e.label}` : "a deleted version";
  const chip = e.chipId ? ` (chip ${e.chipId.slice(0, 8)}…)` : "";
  const text = {
    applied: <><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {v} installed and verified</>,
    captured: <><Usb className="h-3.5 w-3.5" /> {v} saved from the drone</>,
    linked: <><Link2 className="h-3.5 w-3.5" /> Flight controller linked {METHOD_TEXT[e.method ?? ""] ?? ""}{chip}</>,
    relinked: <><Link2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Flight controller replaced and re-linked{chip}</>,
    unlinked: <><Unlink className="h-3.5 w-3.5" /> Flight controller unlinked{chip}</>,
  }[e.kind];
  return (
    <li className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 text-foreground">{text}</span>
      <span>· {when(e.createdAt)}{e.actor && <> · {e.actor}</>}{e.firmware && <span className="font-mono"> · ArduPilot {e.firmware}</span>}</span>
    </li>
  );
}

/** Full file, or a shareable one without per-drone params (replaces the Filter tool). */
function DownloadMenu({ versionId, fileName }: { versionId: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setOpen(false); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function download(shareable: boolean) {
    setOpen(false);
    setBusy(true);
    const res = await fetch(`/api/versions/${versionId}/file${shareable ? "?shareable=1" : ""}`);
    setBusy(false);
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}${shareable ? "-shareable" : ""}.param`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={ref} className="relative">
      <BusyButton
        type="button"
        busy={busy}
        busyLabel="Preparing…"
        icon={<Download className="h-3.5 w-3.5" />}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
      >
        Download <ChevronDown className="h-3 w-3" />
      </BusyButton>
      {open && (
        <div id={menuId} role="menu" className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <button role="menuitem" type="button" onClick={() => download(false)} className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary cursor-pointer">
            <span className="font-medium text-foreground">Full file</span>
            <span className="block text-muted-foreground">Every param, exactly as stored.</span>
          </button>
          <button role="menuitem" type="button" onClick={() => download(true)} className="block w-full border-t border-border px-3 py-2 text-left text-xs hover:bg-secondary cursor-pointer">
            <span className="font-medium text-foreground">Shareable</span>
            <span className="block text-muted-foreground">Without per-drone params (calibration, tuning, radio, IDs), safe to load on another airframe.</span>
          </button>
        </div>
      )}
    </div>
  );
}

function RestoreDialog({ v, nextLabel, isAdmin, onClose, onSaved }: {
  v: TimelineVersion;
  nextLabel: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [changelog, setChangelog] = useState(`Restored v${v.label}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/versions/${v.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changelog }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Could not restore"); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Restore v{v.label}</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-sm text-foreground">
            This saves a copy of v{v.label} as <span className="font-mono font-semibold">v{nextLabel}</span>.
            {isAdmin
              ? ` v${nextLabel} becomes the target, and the drone is offered it the next time it is connected.`
              : ` v${nextLabel} waits for AIR6 to approve it before it becomes the target.`}
          </p>
          <p className="text-xs text-muted-foreground">Nothing in the history is changed or removed.</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Why? *</label>
            <input id={id} required value={changelog} onChange={(e) => setChangelog(e.target.value)} className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
          <BusyButton type="submit" busy={busy} busyLabel="Saving…" disabled={!changelog.trim()} icon={<RotateCcw className="h-3.5 w-3.5" />} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Save as v{nextLabel}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
