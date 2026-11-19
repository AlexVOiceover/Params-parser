"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";
import { Badge } from "@/components/status-badge";
import { modelHref } from "@/lib/versions";

export interface ModelRow {
  id: string;
  name: string;
  description: string | null;
  template: string | null;
  pending: string | null;
  drones: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  description: string | null;
  models: ModelRow[];
}

const NEW_LINE = "__new__";

type OpenDialog =
  | { kind: "add"; lineId: string }
  | { kind: "editLine" | "deleteLine"; line: FamilyGroup }
  | { kind: "editVariant" | "deleteVariant"; line: FamilyGroup; variant: ModelRow };

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function ModelList({ families, isAdmin }: { families: FamilyGroup[]; isAdmin: boolean }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const close = () => setOpen(null);
  const done = () => { setOpen(null); startTransition(() => router.refresh()); };

  // One column template for every product line, so the columns line up from card to card.
  const template = `minmax(0, 1.6fr) minmax(0, 1.2fr) 6rem${isAdmin ? " 4.5rem" : ""}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className={pageTitleClass}>Models</h1>
          {isAdmin && (
            <button type="button" onClick={() => setOpen({ kind: "add", lineId: NEW_LINE })} className={buttonClass("primary", "md")}>
              <Plus className="h-4 w-4" /> Add product line
            </button>
          )}
        </div>
        <p className={pageLeadClass}>
          Product lines and their variants. Each variant has a template: the reference params a new drone of that model starts from.
        </p>
      </div>

      {families.length === 0 ? (
        <div className={`${cardClass} px-6 py-14 text-center`}>
          <p className="text-sm font-medium text-foreground">No models yet.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isAdmin ? "Add a product line to start. It comes with a first variant, ready for its template." : "An admin has not added a product line yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {families.some((f) => f.models.length > 0) && (
            // px-px stands in for the cards' border, so the labels sit exactly over the columns.
            <div className="hidden px-px md:block">
              <div className="grid items-center gap-4 pl-15 pr-4 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: template }}>
                <span>Variant</span>
                <span>Template</span>
                <span>Drones</span>
                {isAdmin && <span className="sr-only">Actions</span>}
              </div>
            </div>
          )}
          <div aria-busy={refreshing || undefined} className={`flex flex-col gap-3 ${refreshing ? "opacity-60" : ""}`}>
            {families.map((f) => (
              <ProductLineCard
                key={f.id}
                line={f}
                isAdmin={isAdmin}
                template={template}
                onAddVariant={() => setOpen({ kind: "add", lineId: f.id })}
                onEdit={() => setOpen({ kind: "editLine", line: f })}
                onDelete={() => setOpen({ kind: "deleteLine", line: f })}
                onEditVariant={(variant) => setOpen({ kind: "editVariant", line: f, variant })}
                onDeleteVariant={(variant) => setOpen({ kind: "deleteVariant", line: f, variant })}
              />
            ))}
          </div>
        </div>
      )}

      {open?.kind === "add" && (
        <AddModelDialog families={families} initialFamilyId={open.lineId} onClose={close} onAdded={done} />
      )}
      {open?.kind === "editLine" && (
        <EditDialog
          title="Edit product line"
          nameLabel="Product line name"
          url={`/api/admin/families/${open.line.id}`}
          name={open.line.name}
          description={open.line.description}
          onClose={close}
          onSaved={done}
        />
      )}
      {open?.kind === "editVariant" && (
        <EditDialog
          title="Edit variant"
          nameLabel="Variant name"
          lineName={open.line.name}
          url={`/api/admin/variants/${open.variant.id}`}
          name={open.variant.name}
          description={open.variant.description}
          onClose={close}
          onSaved={done}
        />
      )}
      {open?.kind === "deleteLine" && (
        <DeleteDialog
          title={`Delete ${open.line.name}?`}
          url={`/api/admin/families/${open.line.id}`}
          confirmLabel="Delete product line"
          onClose={close}
          onDeleted={done}
        >
          It has no variants left, so only the product line itself is removed. This cannot be undone.
        </DeleteDialog>
      )}
      {open?.kind === "deleteVariant" && (
        <DeleteDialog
          title={`Delete ${open.line.name} · ${open.variant.name}?`}
          url={`/api/admin/variants/${open.variant.id}`}
          confirmLabel="Delete variant"
          onClose={close}
          onDeleted={done}
        >
          The variant is removed from {open.line.name}.
          {(open.variant.template || open.variant.pending) && " This also deletes its template history."}
          {" "}This cannot be undone.
        </DeleteDialog>
      )}
    </div>
  );
}

function ProductLineCard({ line, isAdmin, template, onAddVariant, onEdit, onDelete, onEditVariant, onDeleteVariant }: {
  line: FamilyGroup;
  isAdmin: boolean;
  template: string;
  onAddVariant: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditVariant: (variant: ModelRow) => void;
  onDeleteVariant: (variant: ModelRow) => void;
}) {
  const headingId = useId();
  const drones = line.models.reduce((n, m) => n + m.drones, 0);
  const hasVariants = line.models.length > 0;

  return (
    <section aria-labelledby={headingId} className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 px-4 py-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Boxes className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-sm font-semibold text-foreground">{line.name}</h2>
          {line.description && <p className="text-[13px] text-muted-foreground">{line.description}</p>}
          <p className="text-xs text-muted-foreground">{count(line.models.length, "variant")} · {count(drones, "drone")}</p>
        </div>
        {isAdmin && (
          <div className="flex basis-full items-center gap-1 pl-11 sm:basis-auto sm:pl-0">
            <button type="button" onClick={onAddVariant} className={buttonClass("secondary", "sm", "mr-1")}>
              <Plus className="h-3.5 w-3.5" /> Add variant
            </button>
            <button type="button" aria-label={`Edit ${line.name}`} title="Edit name and description" onClick={onEdit} className={buttonClass("ghost", "icon")}>
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={hasVariants ? `Delete ${line.name}: delete its variants first` : `Delete ${line.name}`}
              title={hasVariants ? "Delete its variants first" : `Delete ${line.name}`}
              disabled={hasVariants}
              onClick={onDelete}
              className={buttonClass("dangerGhost", "icon")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {hasVariants ? (
        <ul className="relative border-t border-border before:absolute before:bottom-3 before:left-8 before:top-0 before:w-px before:bg-border">
          {line.models.map((m) => (
            <VariantRow key={m.id} variant={m} isAdmin={isAdmin} template={template} onEdit={() => onEditVariant(m)} onDelete={() => onDeleteVariant(m)} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-border py-3 pl-15 pr-4 text-[13px] text-muted-foreground">No variants yet.</p>
      )}
    </section>
  );
}

function VariantRow({ variant: m, isAdmin, template, onEdit, onDelete }: {
  variant: ModelRow;
  isAdmin: boolean;
  template: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inUse = m.drones > 0;
  const inUseReason = `${m.drones} drone${m.drones === 1 ? " uses" : "s use"} it — move or delete them first`;

  return (
    <li className="relative ml-15 border-b border-border last:border-b-0 before:absolute before:-left-7 before:top-1/2 before:h-px before:w-4 before:bg-border">
      <Link
        href={modelHref(m.id)}
        className="group -ml-3 flex flex-col gap-1.5 py-3 pl-3 pr-4 outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 cursor-pointer md:grid md:items-center md:gap-4"
        style={{ gridTemplateColumns: template }}
      >
        <span className={`min-w-0 ${isAdmin ? "pr-18 md:pr-0" : ""}`}>
          <span className="block text-sm font-medium text-foreground group-hover:text-primary">{m.name}</span>
          {m.description && <span className="block text-[13px] leading-snug text-muted-foreground">{m.description}</span>}
        </span>
        {/* On phones the template and the drone count share one line; from md up they are two columns. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {m.template ? (
              <>
                <span className="text-muted-foreground md:sr-only">Template</span>
                <span className="font-mono text-foreground">v{m.template}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No template yet</span>
            )}
            {m.pending && (
              <Badge tone="info" title={`v${m.pending} was proposed and waits for an admin to approve it.`}>
                <Clock className="h-3 w-3" aria-hidden="true" />
                v{m.pending} to review
              </Badge>
            )}
          </span>
          <span aria-hidden="true" className="text-[13px] text-muted-foreground md:hidden">·</span>
          <span className={`text-[13px] ${inUse ? "text-foreground" : "text-muted-foreground"}`}>{count(m.drones, "drone")}</span>
        </span>
        {isAdmin && <span aria-hidden="true" className="hidden md:block" />}
      </Link>
      {isAdmin && (
        // Outside the link, over its empty last column, so these never open the model.
        <div className="absolute right-2 top-1.5 flex items-center gap-1 md:right-4 md:top-1/2 md:-translate-y-1/2">
          <button type="button" aria-label={`Edit ${m.name}`} title="Edit name and description" onClick={onEdit} className={buttonClass("ghost", "icon")}>
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={inUse ? `Delete ${m.name}: ${inUseReason}` : `Delete ${m.name}`}
            title={inUse ? inUseReason : "Delete this variant and its template history"}
            disabled={inUse}
            onClick={onDelete}
            className={buttonClass("dangerGhost", "icon")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function EditDialog({ title, nameLabel, lineName, url, name: savedName, description: savedDescription, onClose, onSaved }: {
  title: string;
  nameLabel: string;
  /** For a variant: its product line, to show the full model name. */
  lineName?: string;
  url: string;
  name: string;
  description: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(savedName);
  const [description, setDescription] = useState(savedDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), description: useId(), hint: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setBusy(false);
      setError(b.error ?? "That did not work");
      return;
    }
    onSaved();
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Saving…" disabled={!name.trim()}>Save</BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className={labelClass}>{nameLabel}</label>
        <input
          id={ids.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={lineName ? ids.hint : undefined}
          className={`${fieldClass} w-full`}
        />
        {lineName && (
          <p id={ids.hint} className="text-xs text-muted-foreground">
            Its drones show the model as {lineName} · {name.trim() || "…"}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className={labelClass}>Description</label>
        <input id={ids.description} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={`${fieldClass} w-full`} />
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

function DeleteDialog({ title, url, confirmLabel, onClose, onDeleted, children }: {
  title: string;
  url: string;
  confirmLabel: string;
  onClose: () => void;
  onDeleted: () => void;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setBusy(false);
      setError(b.error ?? "That did not work");
      return;
    }
    onDeleted();
  }

  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="button" variant="danger" busy={busy} busyLabel="Deleting…" onClick={remove}>{confirmLabel}</BusyButton>
        </>
      }
    >
      <p className="text-sm text-foreground">{children}</p>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

function AddModelDialog({ families, initialFamilyId, onClose, onAdded }: {
  families: FamilyGroup[];
  initialFamilyId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [familyId, setFamilyId] = useState(initialFamilyId);
  const [familyName, setFamilyName] = useState("");
  // Null until the user types, so the suggested name can follow the chosen product line.
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { family: useId(), familyName: useId(), variant: useId(), hint: useId() };
  const isNew = familyId === NEW_LINE;
  const hasBase = !isNew && !!families.find((f) => f.id === familyId)?.models.some((m) => m.name.trim().toLowerCase() === "base");
  const variant = typed ?? (hasBase ? "" : "Base");

  async function post(url: string, body: { name: string; familyId?: string }): Promise<{ id?: string } | null> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({})) as { error?: string; id?: string };
    if (!res.ok) { setError(b.error ?? "Could not add the model"); return null; }
    return { id: b.id };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let ok = true;
    if (isNew) {
      // A new model line comes with a "Base" variant.
      const fam = await post("/api/admin/families", { name: familyName.trim() });
      ok = !!fam;
      if (fam?.id && variant.trim() && variant.trim() !== "Base") ok = !!(await post("/api/admin/variants", { familyId: fam.id, name: variant.trim() }));
    } else {
      ok = !!(await post("/api/admin/variants", { familyId, name: variant.trim() }));
    }
    setBusy(false);
    if (ok) onAdded();
  }

  return (
    <Dialog
      title={isNew ? "Add product line" : "Add variant"}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Adding…" disabled={!variant.trim() || (isNew && !familyName.trim())}>
            {isNew ? "Add product line" : "Add variant"}
          </BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.family} className={labelClass}>Product line</label>
        <select id={ids.family} value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={`${fieldClass} w-full cursor-pointer`}>
          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          <option value={NEW_LINE}>New product line…</option>
        </select>
      </div>
      {isNew && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.familyName} className={labelClass}>Product line name</label>
          <input id={ids.familyName} required value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="AIR8" className={`${fieldClass} w-full`} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.variant} className={labelClass}>{isNew ? "First variant" : "Variant name"}</label>
        <input
          id={ids.variant}
          required
          value={variant}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={isNew ? "Base" : "e.g. LiDAR"}
          aria-describedby={isNew ? ids.hint : undefined}
          className={`${fieldClass} w-full`}
        />
        {isNew && (
          <p id={ids.hint} className="text-xs text-muted-foreground">
            Every new product line starts with a variant called “Base”. Type a different name to add that variant as well.
          </p>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
