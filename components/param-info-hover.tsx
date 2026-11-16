"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ParamDefinition } from "@/lib/types";

type Defs = Record<string, ParamDefinition>;

let defsPromise: Promise<Defs> | null = null;

function loadDefs(): Promise<Defs> {
  defsPromise ??= fetch("/api/param-definitions")
    .then((r) => r.json() as Promise<{ params?: Defs }>)
    .then((d) => d.params ?? {})
    .catch(() => {
      defsPromise = null;
      return {};
    });
  return defsPromise;
}

const MAX_OPTIONS = 16;

/**
 * A param name that shows the ArduPilot definition (description, units,
 * default, range, options) on hover, keyboard focus or tap.
 */
export function ParamInfoHover({ name, highlight = [] }: { name: string; highlight?: string[] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [def, setDef] = useState<ParamDefinition | null | undefined>(undefined);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => {
    if (!pos || def !== undefined) return;
    let live = true;
    loadDefs().then((defs) => { if (live) setDef(defs[name] ?? null); });
    return () => { live = false; };
  }, [pos, def, name]);

  function open() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 328));
    setPos(r.bottom > window.innerHeight * 0.6
      ? { left, bottom: window.innerHeight - r.top + 4 }
      : { left, top: r.bottom + 4 });
  }

  const options = def?.Values ? Object.entries(def.Values) : [];
  const bits = def?.Bitmask ? Object.entries(def.Bitmask) : [];

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={open}
        onMouseLeave={() => setPos(null)}
        onFocus={open}
        onBlur={() => setPos(null)}
        onClick={() => (pos ? setPos(null) : open())}
        className="text-left text-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 cursor-pointer whitespace-nowrap"
      >
        {name}
      </button>
      {pos && createPortal(
        <div
          role="tooltip"
          style={pos}
          className="fixed z-100 w-80 max-h-80 overflow-hidden rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg pointer-events-none"
        >
          <p className="font-mono font-medium text-foreground">{name}</p>
          {def === undefined && <p className="mt-1 text-muted-foreground">Loading…</p>}
          {def === null && <p className="mt-1 text-muted-foreground italic">No ArduPilot definition for this param.</p>}
          {def && (
            <div className="mt-1 flex flex-col gap-1.5">
              {def.DisplayName && <p className="font-medium text-foreground">{def.DisplayName}</p>}
              {def.Description && <p className="text-muted-foreground leading-snug line-clamp-5">{def.Description}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {def.Default !== undefined && (
                  <span className="text-muted-foreground">Default <span className="font-mono text-foreground">{def.Default}</span></span>
                )}
                {def.Range && (
                  <span className="text-muted-foreground">Range <span className="font-mono text-foreground">{def.Range.low} – {def.Range.high}</span></span>
                )}
                {def.Units && (
                  <span className="text-muted-foreground">Units <span className="font-mono text-foreground">{def.Units}</span></span>
                )}
                {def.RebootRequired === "True" && <span className="text-amber-600 dark:text-amber-400">Reboot required</span>}
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {options.slice(0, MAX_OPTIONS).map(([k, v]) => (
                    <span key={k} className={highlight.includes(k) ? "text-foreground font-medium" : "text-muted-foreground"}>
                      <span className="font-mono text-primary">{k}</span> = {v}
                    </span>
                  ))}
                  {options.length > MAX_OPTIONS && <span className="text-muted-foreground">+{options.length - MAX_OPTIONS} more</span>}
                </div>
              )}
              {bits.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {bits.slice(0, MAX_OPTIONS).map(([k, v]) => (
                    <span key={k} className="text-muted-foreground">
                      <span className="font-mono text-primary">bit {k}</span> = {v}
                    </span>
                  ))}
                  {bits.length > MAX_OPTIONS && <span className="text-muted-foreground">+{bits.length - MAX_OPTIONS} more</span>}
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
