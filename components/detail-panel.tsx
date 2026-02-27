"use client";

import { useApp } from "@/lib/app-context";
import type { ParamDefinition } from "@/lib/types";

export function DetailPanel() {
  const { selectedParam, paramDefs } = useApp();

  if (!selectedParam) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Click a parameter to see details
      </div>
    );
  }

  const meta: ParamDefinition = paramDefs[selectedParam.name] ?? {};

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <div>
        <h3 className="font-mono text-sm font-bold text-foreground">
          {selectedParam.name}
        </h3>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          Value: {selectedParam.value}
        </p>
      </div>

      {meta.DisplayName && (
        <div>
          <span className="text-xs font-semibold text-group-text">Label</span>
          <p className="text-sm text-foreground">{meta.DisplayName}</p>
        </div>
      )}

      {meta.Description && (
        <div>
          <span className="text-xs font-semibold text-group-text">
            Description
          </span>
          <p className="text-sm text-foreground leading-relaxed">
            {meta.Description}
          </p>
        </div>
      )}

      {meta.Units && (
        <div>
          <span className="text-xs font-semibold text-group-text">Units</span>
          <p className="text-sm text-foreground">{meta.Units}</p>
        </div>
      )}

      {meta.Range && (
        <div>
          <span className="text-xs font-semibold text-group-text">Range</span>
          <p className="font-mono text-xs text-foreground">
            {meta.Range.low} &ndash; {meta.Range.high}
          </p>
        </div>
      )}

      {meta.Values && Object.keys(meta.Values).length > 0 && (
        <div>
          <span className="text-xs font-semibold text-group-text">
            Allowed Values
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            {Object.entries(meta.Values).map(([k, v]) => (
              <p key={k} className="font-mono text-xs text-foreground">
                <span className="text-muted-foreground">{k}</span> = {v}
              </p>
            ))}
          </div>
        </div>
      )}

      {meta.Bitmask && Object.keys(meta.Bitmask).length > 0 && (
        <div>
          <span className="text-xs font-semibold text-group-text">
            Bitmask
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            {Object.entries(meta.Bitmask).map(([bit, label]) => (
              <p key={bit} className="font-mono text-xs text-foreground">
                <span className="text-muted-foreground">bit {bit}:</span>{" "}
                {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {meta.RebootRequired === "True" && (
        <div className="rounded bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive-foreground">
          Reboot required after change
        </div>
      )}

      {!meta.DisplayName && !meta.Description && (
        <p className="text-xs text-muted-foreground italic">
          No definition found in ArduPilot database
        </p>
      )}
    </div>
  );
}
