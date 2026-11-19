"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

const MenuContext = createContext<() => void>(() => {});

interface MenuProps {
  /** What the trigger button shows. */
  trigger: React.ReactNode;
  /** Accessible name and tooltip; required when the trigger is only an icon. */
  label?: string;
  triggerClassName: string;
  align?: "start" | "end";
  /** Tailwind width class of the popover. */
  width?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

/** A button that opens a small list of actions. Closes on outside click, Escape, or picking an item. */
export function Menu({ trigger, label, triggerClassName, align = "start", width = "w-60", disabled, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={`absolute top-full z-30 mt-1.5 ${width} max-w-[calc(100vw-2rem)] ${align === "end" ? "right-0" : "left-0"} rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg`}
        >
          <MenuContext.Provider value={() => setOpen(false)}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** A second line explaining what the item does. */
  hint?: string;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Why the item is disabled. */
  title?: string;
}

export function MenuItem({ icon, children, hint, onSelect, href, destructive, disabled, title }: MenuItemProps) {
  const close = useContext(MenuContext);
  const cls = `flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
    destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary"
  }`;
  const body = (
    <>
      {icon && <span className={`mt-0.5 shrink-0 ${destructive ? "" : "text-muted-foreground"}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block font-medium whitespace-nowrap">{children}</span>
        {hint && <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </>
  );
  if (href && !disabled) {
    return <Link role="menuitem" href={href} onClick={close} className={cls}>{body}</Link>;
  }
  return (
    <button role="menuitem" type="button" disabled={disabled} title={title} onClick={() => { close(); onSelect?.(); }} className={cls}>
      {body}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-border" />;
}
