"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle, Check, ChevronDown, Clock, Copy, Cpu, Download, FileUp, Filter, GitCommitHorizontal, GitCompareArrows,
  Link2, RotateCcw, Target, Trash2, Unlink, Usb, X,
} from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { buttonClass, fieldClass, labelClass, sectionTitleClass } from "@/components/ui/styles";
import { Badge } from "@/components/status-badge";
import { DroneGhostCard } from "@/components/drone-ghost-card";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { NewVersionDialog } from "@/components/new-version-dialog";
import { CopyVersionDialog } from "@/components/copy-version-dialog";
import { SelectionTray, VersionPicker, useCompareSelection, versionLabels } from "@/components/compare/version-picker";
import { useConnectedDroneMatch, refreshDroneMatch } from "@/lib/use-connected-drone-match";
import { latestApproved, pendingProposal, nextLabel } from "@/lib/versions";
import type { TimelineEvent, TimelineVersion } from "@/lib/history";
import type { PickerHistory } from "@/lib/version-picker";

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
}

type Kind = Props["kind"];

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const METHOD_TEXT: Record<string, string> = {
  connect: "at connect",
  messages_line: "from a Mission Planner Messages line",
  assembly: "at assembly",
};

export function HistoryTimeline({ kind, setId, variantId, versions, events, drone, isAdmin, isStaff, fileBase }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const match = useConnectedDroneMatch();
  const [newOpen, setNewOpen] = useState(false);
  const [restoreOf, setRestoreOf] = useState<TimelineVersion | null>(null);
  const [copyOf, setCopyOf] = useState<TimelineVersion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [others, setOthers] = useState<PickerHistory[] | null>(null);
  const [othersFailed, setOthersFailed] = useState(false);
  const selection = useCompareSelection();

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

  // Other drones' and models' versions are only needed while choosing what to compare.
  useEffect(() => {
    if (!comparing || others) return;
    let cancelled = false;
    fetch("/api/versions/picker")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("picker failed"))))
      .then((body: { histories: PickerHistory[] }) => { if (!cancelled) setOthers(body.histories); })
      .catch(() => { if (!cancelled) { setOthersFailed(true); setOthers([]); } });
    return () => { cancelled = true; };
  }, [comparing, others]);

  const labels = useMemo(() => {
    const map = versionLabels(others ?? []);
    for (const v of versions) map.set(v.id, `v${v.label} · ${kind === "drone" ? "this drone" : "this template"}`);
    return map;
  }, [others, versions, kind]);

  function stopComparing() {
    setComparing(false);
    selection.clear();
  }

  // Versions and log entries in one chronological list.
  type Item = { at: string; version?: TimelineVersion; event?: TimelineEvent };
  const items: Item[] = [
    ...versions.map((v) => ({ at: v.createdAt, version: v })),
    // A capture is shown on the version it created, not as a separate line.
    ...events.filter((e) => e.kind !== "captured").map((e) => ({ at: e.createdAt, event: e })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const capturedIds = new Set(events.filter((e) => e.kind === "captured").map((e) => e.versionId));

  /**
   * Staff can put any other version on the connected drone. The target does
   * not move, so the note says what happens on the next connect.
   */
  function installOther(v: TimelineVersion): { notice?: string } | null {
    if (!connectedHere || !isStaff || onDroneId === v.id || target?.id === v.id) return null;
    if (!target) return {};
    const stays = `so this drone will be offered v${target.label} again on its next connect.`;
    return {
      notice: v.needsReview
        ? `v${v.label} is waiting for review. v${target.label} stays the target, ${stays}`
        : `v${target.label} is still the target, ${stays} To make v${v.label} the target, restore it instead.`,
    };
  }

  const flags = (v: TimelineVersion) => ({
    isTarget: target?.id === v.id,
    isProposal: proposal?.id === v.id || v.needsReview,
    superseded: v.needsReview && proposal?.id !== v.id,
    onDrone: onDroneId === v.id,
    captured: capturedIds.has(v.id),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>History</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {kind === "drone" ? "Every saved version of this drone's params, newest first." : "Every version of this model's template, newest first."}
          </p>
        </div>
        {!comparing && (
          <div className="flex flex-wrap items-center gap-2">
            {versions.length > 0 && (
              <button type="button" onClick={() => setComparing(true)} className={buttonClass("secondary")}>
                <GitCompareArrows className="h-3.5 w-3.5" /> Compare versions
              </button>
            )}
            {isStaff && (
              <button type="button" onClick={() => setNewOpen(true)} className={buttonClass("secondary")}>
                <FileUp className="h-3.5 w-3.5" /> New version from file
              </button>
            )}
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-foreground">
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          {notice}
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-3.5 w-3.5" /></button>
        </p>
      )}

      {comparing ? (
        <>
          <SelectionTray selection={selection} labelFor={(id) => labels.get(id) ?? "A version"} onCancel={stopComparing} />
          <ol className="flex flex-col gap-2">
            {versions.map((v) => (
              <SelectableVersion key={v.id} v={v} kind={kind} {...flags(v)} checked={selection.has(v.id)} onToggle={() => selection.toggle(v.id)} />
            ))}
          </ol>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <h3 className={sectionTitleClass}>Add versions from somewhere else</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Other drones, model templates, a .param file, or the connected drone.</p>
            </div>
            {othersFailed && (
              <p role="alert" className="text-[13px] text-destructive">Could not load the versions of other drones. Reload the page to try again.</p>
            )}
            <VersionPicker histories={others} selection={selection} sources={selection} excludeHistoryId={setId ?? undefined} />
          </div>
        </>
      ) : (
        <>
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
            <div className="rounded-xl border border-dashed border-input bg-card px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No versions yet.</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {kind === "drone"
                  ? "Connect the drone to save what is on it, or upload a file."
                  : "Upload the model's reference .param file to make it the template new drones start from."}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <ol className="relative flex flex-col gap-3 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:-translate-x-1/2 before:bg-border">
              {items.map((item) => item.version ? (
                <VersionCard
                  key={item.version.id}
                  v={item.version}
                  {...flags(item.version)}
                  installable={connectedHere && target?.id === item.version.id && onDroneId !== item.version.id}
                  installOther={installOther(item.version)}
                  canRestore={!item.version.needsReview && target?.id !== item.version.id && (isStaff || kind === "drone")}
                  isAdmin={isAdmin}
                  kind={kind}
                  fileBase={fileBase}
                  onRestore={() => setRestoreOf(item.version!)}
                  onCopy={isStaff ? () => setCopyOf(item.version!) : undefined}
                  onChanged={refresh}
                />
              ) : (
                <EventRow key={item.event!.id} e={item.event!} />
              ))}
            </ol>
          )}
        </>
      )}

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

interface VersionFlags {
  isTarget: boolean;
  isProposal: boolean;
  superseded: boolean;
  onDrone: boolean;
  captured: boolean;
}

/** The facts of a version: number, state, who and when, what changed. */
function VersionSummary({ v, kind, isTarget, isProposal, superseded, onDrone, captured }: VersionFlags & { v: TimelineVersion; kind: Kind }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="font-mono text-lg font-semibold leading-6 text-foreground">v{v.label}</span>
        {isTarget && (
          <Badge tone="ok" title={kind === "drone" ? "The version this drone should be on" : "New drones of this model start from it"}>
            <Target className="h-3 w-3" aria-hidden="true" />
            {kind === "drone" ? "Target" : "Current template"}
          </Badge>
        )}
        {isProposal && !superseded && (
          <Badge tone="info" title="Waiting for an admin to approve it">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Proposed · waiting for review
          </Badge>
        )}
        {superseded && <Badge tone="muted" title="A newer version was approved after it">Proposal not taken</Badge>}
        {onDrone && <Badge tone="ok"><Usb className="h-3 w-3" aria-hidden="true" /> On the connected drone</Badge>}
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {when(v.createdAt)}
          {v.author && <> · {v.author}</>}
        </span>
      </div>
      {v.changelog && <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{v.changelog}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <GitCommitHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {v.changes === null ? "First version" : v.changes === 0 ? "Same params as the previous version" : `${v.changes} param${v.changes === 1 ? "" : "s"} changed`}
        </span>
        <span className="flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          {v.firmware ? `ArduPilot ${v.firmware}` : "Firmware not recorded"}
        </span>
        {captured && (
          <span className="flex items-center gap-1">
            <Usb className="h-3.5 w-3.5" aria-hidden="true" />
            Saved from the drone
          </span>
        )}
      </p>
    </div>
  );
}

/** A version while choosing what to compare: the whole card is the tick box. */
function SelectableVersion({ v, kind, checked, onToggle, ...flags }: VersionFlags & { v: TimelineVersion; kind: Kind; checked: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <li>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3.5 rounded-xl border px-4 py-3.5 shadow-xs transition-colors ${
          checked ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-input"
        }`}
      >
        <input id={id} type="checkbox" checked={checked} onChange={onToggle} aria-label={`Compare v${v.label}`} className="mt-0.5 h-5 w-5" />
        <VersionSummary v={v} kind={kind} {...flags} />
      </label>
    </li>
  );
}

function VersionCard({
  v, kind, installable, installOther, canRestore, isAdmin, fileBase, onRestore, onCopy, onChanged, ...flags
}: VersionFlags & {
  v: TimelineVersion;
  kind: Kind;
  installable: boolean;
  /** Set when staff may install this non-target version on the connected drone. */
  installOther: { notice?: string } | null;
  canRestore: boolean;
  isAdmin: boolean;
  fileBase: string;
  onRestore: () => void;
  onCopy?: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isTarget, isProposal, superseded } = flags;
  const pending = isProposal && !superseded;

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

  const quiet = buttonClass("quiet");

  return (
    <li className="relative pl-11">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border ${
          isTarget ? "border-emerald-600 bg-emerald-600 text-white"
          : pending ? "border-sky-500/60 bg-card text-sky-600 dark:text-sky-300"
          : "border-border bg-card text-muted-foreground"
        }`}
      >
        {isTarget ? <Target className="h-4 w-4" /> : pending ? <Clock className="h-4 w-4" /> : <GitCommitHorizontal className="h-4 w-4" />}
      </span>
      <article
        className={`rounded-xl border bg-card shadow-xs ${
          isTarget ? "border-emerald-600/45 ring-1 ring-emerald-500/15" : pending ? "border-sky-500/50" : "border-border"
        }`}
      >
        <div className="px-4 pb-3 pt-3.5">
          <VersionSummary v={v} kind={kind} {...flags} />
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          {installable && (
            <ApplyUpdateButton version={{ id: v.id, label: v.label, firmware: v.firmware }} label={`Install v${v.label} on the drone`} />
          )}
          {isAdmin && pending && (
            <BusyButton
              type="button"
              variant="primary"
              busy={busy === "approve"}
              busyLabel="Approving…"
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={() => act("approve")}
              className="mr-1"
            >
              Approve as {kind === "drone" ? "target" : "template"}
            </BusyButton>
          )}
          <DownloadMenu versionId={v.id} fileName={`${fileBase}-v${v.label}`} triggerClassName={quiet} />
          <Link
            href={`/filter?versionId=${v.id}`}
            title="Open this version in the Filter tool, to prepare a file for another drone"
            className={quiet}
          >
            <Filter className="h-3.5 w-3.5 text-muted-foreground" /> Open in Filter
          </Link>
          {onCopy && (
            <button type="button" onClick={onCopy} title="Save a copy as the next version of another drone or a model template" className={quiet}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Copy to…
            </button>
          )}
          {canRestore && (
            <button type="button" onClick={onRestore} title="Save a copy of this version as the newest one" className={quiet}>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> Restore
            </button>
          )}
          {installOther && (
            <ApplyUpdateButton
              version={{ id: v.id, label: v.label, firmware: v.firmware }}
              variant="quiet"
              label="Install on the drone"
              notice={installOther.notice}
            />
          )}
          {isAdmin && (
            confirmDelete ? (
              <span className="ml-auto flex flex-wrap items-center gap-1.5 pl-2">
                <span className="text-[13px] text-foreground">Delete v{v.label}?</span>
                <BusyButton type="button" variant="danger" busy={busy === "delete"} busyLabel="Deleting…" onClick={() => act("delete")}>
                  Delete
                </BusyButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass("secondary")}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete v${v.label}`}
                title={isProposal ? "Reject and delete this proposal" : "Delete this version"}
                className={buttonClass("dangerGhost", "icon", "ml-auto")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        {error && <p role="alert" className="border-t border-border px-4 py-2 text-[13px] text-destructive">{error}</p>}
      </article>
    </li>
  );
}

function EventRow({ e }: { e: TimelineEvent }) {
  const v = e.label ? `v${e.label}` : "a deleted version";
  const chip = e.chipId ? ` (chip ${e.chipId.slice(0, 8)}…)` : "";
  const text = {
    applied: <><ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> {v} installed and verified</>,
    captured: <><Usb className="h-3.5 w-3.5 shrink-0" /> {v} saved from the drone</>,
    linked: <><Link2 className="h-3.5 w-3.5 shrink-0" /> Flight controller linked {METHOD_TEXT[e.method ?? ""] ?? ""}{chip}</>,
    relinked: <><Link2 className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" /> Flight controller replaced and re-linked{chip}</>,
    unlinked: <><Unlink className="h-3.5 w-3.5 shrink-0" /> Flight controller unlinked{chip}</>,
  }[e.kind];
  return (
    <li className="relative flex flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 pl-11 text-[13px] text-muted-foreground">
      <span aria-hidden="true" className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-input bg-background" />
      <span className="flex items-center gap-1.5 text-foreground">{text}</span>
      <span>
        {when(e.createdAt)}
        {e.actor && <> · {e.actor}</>}
        {e.firmware && <> · ArduPilot {e.firmware}</>}
      </span>
    </li>
  );
}

/** Full file, or a shareable one without per-drone params. */
function DownloadMenu({ versionId, fileName, triggerClassName }: { versionId: string; fileName: string; triggerClassName: string }) {
  const [busy, setBusy] = useState(false);

  async function download(shareable: boolean) {
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
    <Menu
      width="w-72"
      disabled={busy}
      triggerClassName={triggerClassName}
      trigger={busy
        ? <><Spinner /> Preparing…</>
        : <><Download className="h-3.5 w-3.5 text-muted-foreground" /> Download <ChevronDown className="h-3 w-3 text-muted-foreground" /></>}
    >
      <MenuItem onSelect={() => download(false)} hint="Every param, exactly as stored.">Full file</MenuItem>
      <MenuItem onSelect={() => download(true)} hint="Without per-drone params (calibration, tuning, radio, IDs), safe to load on another airframe.">Shareable</MenuItem>
    </Menu>
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
    <Dialog
      title={`Restore v${v.label}`}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Saving…" disabled={!changelog.trim()} icon={<RotateCcw className="h-3.5 w-3.5" />}>
            Save as v{nextLabel}
          </BusyButton>
        </>
      }
    >
      <p className="text-sm text-foreground">
        This saves a copy of v{v.label} as <span className="font-mono font-semibold">v{nextLabel}</span>.
        {isAdmin
          ? ` v${nextLabel} becomes the target, and the drone is offered it the next time it is connected.`
          : ` v${nextLabel} waits for AIR6 to approve it before it becomes the target.`}
      </p>
      <p className="text-[13px] text-muted-foreground">Nothing in the history is changed or removed.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={labelClass}>Why? <span className="text-destructive">*</span></label>
        <input id={id} required value={changelog} onChange={(e) => setChangelog(e.target.value)} className={`${fieldClass} w-full`} />
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
