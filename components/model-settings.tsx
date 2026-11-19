"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { buttonClass, cardClass, fieldClass, labelClass, sectionTitleClass } from "@/components/ui/styles";

type Action = "save" | "copy" | "delete";

/** Admin: rename or delete a model (variant). Deleting is refused while drones use it. */
export function ModelSettings({ variantId, familyId, name, description, droneCount }: {
  variantId: string;
  familyId: string | null;
  name: string;
  description: string | null;
  droneCount: number;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [desc, setDesc] = useState(description ?? "");
  const [copyName, setCopyName] = useState(`${name} copy`);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<{ action: Action; text: string } | null>(null);
  const id = useId();
  const descId = useId();
  const copyId = useId();
  const changed = !!value.trim() && (value.trim() !== name || desc !== (description ?? ""));

  async function duplicate() {
    setBusy("copy");
    setError(null);
    const res = await fetch(`/api/admin/variants/${variantId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, name: copyName.trim(), description: desc }),
    });
    const b = await res.json().catch(() => ({})) as { error?: string; variantId?: string };
    if (!res.ok || !b.variantId) {
      setBusy(null);
      setError({ action: "copy", text: b.error ?? "Could not duplicate" });
      return;
    }
    // Stays busy until the copy's page replaces this one, so a second click cannot make a second copy.
    router.push(`/models/${b.variantId}`);
  }

  async function call(method: "PATCH" | "DELETE") {
    const action = method === "PATCH" ? "save" : "delete";
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/variants/${variantId}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name: value.trim(), description: desc }) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setBusy(null);
      setError({ action, text: b.error ?? "That did not work" });
      setConfirm(false);
      return;
    }
    if (method === "DELETE") {
      router.push("/models");
      return;
    }
    setBusy(null);
    startTransition(() => router.refresh());
  }

  const errorFor = (action: Action) =>
    error?.action === action && <p role="alert" className="text-[13px] text-destructive">{error.text}</p>;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={sectionTitleClass}>Model settings</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Only admins see this section.</p>
      </div>
      <div className={`${cardClass} divide-y divide-border`}>
        <div className="flex flex-col gap-2 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">Name and description</h3>
          <p className="text-[13px] text-muted-foreground">How this variant is listed on Models, on its drones and in downloaded file names.</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 sm:w-56">
              <label htmlFor={id} className={labelClass}>Variant name</label>
              <input id={id} value={value} onChange={(e) => setValue(e.target.value)} className={`${fieldClass} w-full`} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={descId} className={labelClass}>Description</label>
              <input id={descId} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" className={`${fieldClass} w-full`} />
            </div>
            {changed && (
              <div className="flex items-center sm:h-9">
                <BusyButton type="button" variant="primary" busy={busy === "save" || refreshing} busyLabel="Saving…" disabled={busy !== null} onClick={() => call("PATCH")}>
                  Save
                </BusyButton>
              </div>
            )}
          </div>
          {errorFor("save")}
        </div>

        <div className="flex flex-col gap-2 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">Duplicate as a new variant</h3>
          <p className="text-[13px] text-muted-foreground">
            {familyId
              ? "Makes a new variant in this product line with the same description and template history. Drones are not copied."
              : "This variant has no product line, so it cannot be duplicated."}
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 sm:w-72">
              <label htmlFor={copyId} className={labelClass}>Name of the new variant</label>
              <input id={copyId} value={copyName} onChange={(e) => setCopyName(e.target.value)} disabled={!familyId} className={`${fieldClass} w-full`} />
            </div>
            <div className="flex items-center sm:h-9">
              <BusyButton
                type="button"
                variant="secondary"
                busy={busy === "copy"}
                busyLabel="Duplicating…"
                icon={<CopyPlus className="h-3.5 w-3.5" />}
                disabled={!copyName.trim() || !familyId || busy !== null}
                onClick={duplicate}
              >
                Duplicate variant
              </BusyButton>
            </div>
          </div>
          {errorFor("copy")}
        </div>

        <div className="flex flex-col gap-2 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">Delete this model</h3>
          <p className="text-[13px] text-muted-foreground">
            {droneCount > 0
              ? `${droneCount} drone${droneCount === 1 ? " uses" : "s use"} this model, so it cannot be deleted. Move them to another model or delete them first.`
              : "Removes this variant and its whole template history. This cannot be undone."}
          </p>
          {droneCount === 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {confirm ? (
                <>
                  <span className="text-[13px] font-medium text-foreground">Delete this model and its template history?</span>
                  <BusyButton type="button" variant="danger" busy={busy === "delete"} busyLabel="Deleting…" disabled={busy !== null} onClick={() => call("DELETE")}>
                    Delete model
                  </BusyButton>
                  <button type="button" onClick={() => setConfirm(false)} disabled={busy === "delete"} className={buttonClass("secondary")}>Keep it</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirm(true)} disabled={busy !== null} className={buttonClass("dangerOutline")}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete model
                </button>
              )}
            </div>
          )}
          {errorFor("delete")}
        </div>
      </div>
    </section>
  );
}
