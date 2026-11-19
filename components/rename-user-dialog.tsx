"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { BusyButton } from "@/components/ui/busy";
import { buttonClass, fieldClass, labelClass } from "@/components/ui/styles";

/** An admin changes a user's display name from the Users page. */
export function RenameUserDialog({ userId, current, email, onClose, onSaved }: {
  userId: string;
  current: string;
  email: string | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const hintId = useId();
  const unchanged = name.trim() === current;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (unchanged || !name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    }).catch(() => null);
    const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string; username?: string };
    setBusy(false);
    if (!res?.ok) {
      setError(body.error ?? "Could not save the name");
      return;
    }
    onSaved(body.username ?? name.trim());
  }

  return (
    <Dialog
      title="Change name"
      size="sm"
      busy={busy}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Saving…" disabled={unchanged || !name.trim()}>Save name</BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className={labelClass}>Name</label>
        <input
          id={fieldId}
          value={name}
          maxLength={40}
          aria-describedby={hintId}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          Shown in the header, on reviews and in version histories{email ? <> for <span className="break-all">{email}</span></> : null}. Signing in still uses the e-mail.
        </p>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
