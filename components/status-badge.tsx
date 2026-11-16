import type { FleetStatus } from "@/lib/fleet";

const TONE = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  muted: "border-border bg-secondary text-muted-foreground",
} as const;

export type Tone = keyof typeof TONE;

export function Badge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE[tone]}`}>
      {children}
    </span>
  );
}

interface StatusInput {
  status: FleetStatus;
  target: string | null;
  pending: string | null;
  lastLabel: string | null;
}

/** One sentence per status, worded for whoever is looking. */
function describeStatus(s: StatusInput, isStaff: boolean): { label: string; tone: Tone; hint: string } {
  switch (s.status) {
    case "up_to_date":
      return { label: "Up to date", tone: "ok", hint: `Last verified on v${s.target}, the current target.` };
    case "behind":
      return {
        label: `Update to v${s.target}`,
        tone: "warn",
        hint: `Last verified on ${s.lastLabel ? `v${s.lastLabel}` : "an older version"}. v${s.target} is offered the next time it is connected.`,
      };
    case "review":
      return isStaff
        ? { label: `v${s.pending} to review`, tone: "info", hint: `v${s.pending} was proposed and waits for an admin to approve it.` }
        : { label: `v${s.pending} with AIR6`, tone: "info", hint: `Your v${s.pending} is waiting for AIR6 to review it.` };
    case "unverified":
      return { label: "Not checked yet", tone: "muted", hint: "No connect has verified it yet. Connect it to check." };
    case "not_linked":
      return { label: "Not linked", tone: "muted", hint: "Its flight controller is not linked yet. Connect it to link." };
    case "no_version":
      return { label: "No version yet", tone: "muted", hint: "Its history has no approved version." };
  }
}

export function FleetStatusBadge({ row, isStaff }: { row: StatusInput; isStaff: boolean }) {
  const d = describeStatus(row, isStaff);
  return <Badge tone={d.tone} title={d.hint}>{d.label}</Badge>;
}
