"use client";

import { COMMAND_DEFS } from "@/lib/mission-commands";
import type { WaypointAction } from "@/lib/use-mission";

interface Props {
  action: WaypointAction;
  params: Record<string, number>;
  onChange: (key: string, value: number) => void;
  expertMode?: boolean;
}

export function WaypointParams({ action, params, onChange, expertMode = false }: Props) {
  const def = COMMAND_DEFS[action];
  if (!def || def.params.length === 0) return null;

  const visibleParams = def.params.filter((p) => expertMode || !p.expert);
  if (visibleParams.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-3 pb-2 bg-secondary/20">
      {visibleParams.map((p) => {
        const val = params[p.key] ?? p.default ?? 0;
        return (
          <div key={p.key} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">
              {p.label}{p.unit ? ` (${p.unit})` : ""}
            </span>
            {p.type === "select" && p.options ? (
              <select
                value={val}
                onChange={(e) => onChange(p.key, parseFloat(e.target.value))}
                className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-foreground outline-none cursor-pointer"
              >
                {p.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={val}
                min={p.min}
                max={p.max}
                step="any"
                onChange={(e) => onChange(p.key, parseFloat(e.target.value) || 0)}
                className="w-20 rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-foreground text-right outline-none focus:ring-1 focus:ring-ring"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
