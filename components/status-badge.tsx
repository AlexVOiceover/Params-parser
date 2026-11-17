import { ArrowUpCircle, CheckCircle2, CircleDashed, Clock, HelpCircle, Unlink, type LucideIcon } from "lucide-react";
import type { FleetStatus } from "@/lib/fleet";

const TONE = {
  ok: "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
  warn: "border-amber-600/30 bg-amber-500/15 text-amber-800 dark:border-amber-400/25 dark:text-amber-300",
  info: "border-sky-600/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300",
  muted: "border-border bg-secondary text-muted-foreground",
} as const;

export type Tone = keyof typeof TONE;

export function Badge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}>
      {children}
    </span>
  );
}

/** How each status looks and is named in filters and group summaries. */
export const STATUS_META: Record<FleetStatus, { tone: Tone; icon: LucideIcon; dot: string; name: string }> = {
  review: { tone: "info", icon: Clock, dot: "bg-sky-500", name: "To review" },
  behind: { tone: "warn", icon: ArrowUpCircle, dot: "bg-amber-500", name: "Update waiting" },
  unverified: { tone: "muted", icon: HelpCircle, dot: "bg-slate-400", name: "Not checked yet" },
  not_linked: { tone: "muted", icon: Unlink, dot: "bg-slate-400", name: "Not linked" },
  no_version: { tone: "muted", icon: CircleDashed, dot: "bg-slate-400", name: "No version yet" },
  up_to_date: { tone: "ok", icon: CheckCircle2, dot: "bg-emerald-500", name: "Up to date" },
};

/** Clients do not review; for them a proposal is "with AIR6". */
export function statusName(status: FleetStatus, isStaff: boolean): string {
  return status === "review" && !isStaff ? "With AIR6" : STATUS_META[status].name;
}

interface StatusInput {
  status: FleetStatus;
  target: string | null;
  pending: string | null;
  lastLabel: string | null;
}

/** One label and one sentence per status, worded for whoever is looking. */
export function describeStatus(s: StatusInput, isStaff: boolean): { label: string; hint: string } {
  switch (s.status) {
    case "up_to_date":
      return { label: "Up to date", hint: `Last verified on v${s.target}, the current target.` };
    case "behind":
      return {
        label: `Update to v${s.target}`,
        hint: `Last verified on ${s.lastLabel ? `v${s.lastLabel}` : "an older version"}. v${s.target} is offered the next time it is connected.`,
      };
    case "review":
      return isStaff
        ? { label: `v${s.pending} to review`, hint: `v${s.pending} was proposed and waits for an admin to approve it.` }
        : { label: `v${s.pending} with AIR6`, hint: `Your v${s.pending} is waiting for AIR6 to review it.` };
    case "unverified":
      return { label: "Not checked yet", hint: "No connect has verified it yet. Connect it to check." };
    case "not_linked":
      return { label: "Not linked", hint: "Its flight controller is not linked yet. Connect it to link." };
    case "no_version":
      return { label: "No version yet", hint: "Its history has no approved version." };
  }
}

export function FleetStatusBadge({ row, isStaff }: { row: StatusInput; isStaff: boolean }) {
  const d = describeStatus(row, isStaff);
  const { tone, icon: Icon } = STATUS_META[row.status];
  return (
    <Badge tone={tone} title={d.hint}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {d.label}
    </Badge>
  );
}
