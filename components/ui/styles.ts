// One set of looks for the whole app. Use these instead of hand-writing class strings,
// so a button, a field or a card is the same thing on every screen.

export type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "danger" | "dangerOutline" | "dangerGhost" | "warn";
export type ButtonSize = "sm" | "md" | "icon";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  /** The one thing to do next in an area. At most one per card or toolbar. */
  primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  /** Other actions that deserve a visible button. */
  secondary: "border border-border bg-card text-foreground shadow-xs hover:bg-secondary",
  /** Labelled actions in a row under content: no border, so a row of them stays calm. */
  quiet: "text-foreground hover:bg-secondary",
  /** Icon-only and tertiary actions. */
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  /** Confirms something destructive. */
  danger: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
  /** Opens a destructive confirmation, as a labelled button. */
  dangerOutline: "border border-destructive/40 bg-card text-destructive shadow-xs hover:bg-destructive/10",
  /** Opens a destructive confirmation, as an icon. */
  dangerGhost: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
  /** Writes to the drone. */
  warn: "bg-amber-500 text-white shadow-xs hover:bg-amber-600",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8",
};

/** `extra` is for layout only (ml-auto, w-full): a colour passed there would fight the variant's own. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "sm", extra = ""): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${extra}`.trim();
}

/** A white surface on the grey page. */
export const cardClass = "rounded-xl border border-border bg-card shadow-xs";

const FIELD_BASE =
  "rounded-lg border border-input bg-field px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60";

/** Text inputs and selects. Add `font-mono` for serials and param names. */
export const fieldClass = `h-9 ${FIELD_BASE}`;

/** Multi-line text. Its height comes from `rows`. */
export const textareaClass = `py-2 ${FIELD_BASE}`;

export const labelClass = "text-[13px] font-medium text-foreground";

/** Page title (h1) and the line under it. */
export const pageTitleClass = "text-2xl font-semibold tracking-tight text-foreground";
export const pageLeadClass = "mt-1 text-sm text-muted-foreground";

/** Section title (h2) inside a page. */
export const sectionTitleClass = "text-base font-semibold text-foreground";
