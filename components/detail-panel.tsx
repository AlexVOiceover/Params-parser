"use client";

import { TriangleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { validateParam } from "@/lib/param-engine";
import type { ParamDefinition } from "@/lib/types";

export function DetailPanel() {
  const { selectedParam, paramDefs, paramNotes, setParamNote, username, acknowledgedInvalid, acknowledgeParam } = useApp();

  if (!selectedParam) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Click a parameter to see details
      </div>
    );
  }

  const meta: ParamDefinition = paramDefs[selectedParam.name] ?? {};
  const validationReason = Object.keys(meta).length ? validateParam(selectedParam.value, meta) : null;
  const isAcknowledged = acknowledgedInvalid.has(selectedParam.name);

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      {validationReason && (
        <div className={cn(
          "rounded border px-3 py-2 flex flex-col gap-1.5",
          isAcknowledged ? "border-blue-700/50 bg-blue-950/30" : "border-red-800/50 bg-red-950/40"
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              isAcknowledged ? "text-blue-400" : "text-red-400"
            )}>
              {isAcknowledged
                ? <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                : <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              }
              {isAcknowledged ? "Acknowledged" : "Value out of specification"}
            </span>
            <button
              onClick={() => acknowledgeParam(selectedParam.name)}
              className={cn(
                "shrink-0 text-[10px] rounded px-1.5 py-0.5 cursor-pointer transition-colors",
                isAcknowledged
                  ? "bg-blue-900/40 text-blue-300 hover:bg-blue-800/50"
                  : "bg-red-900/50 text-red-300 hover:bg-red-800/50"
              )}
            >
              {isAcknowledged ? "Undo" : "Acknowledge"}
            </button>
          </div>
          <p className={cn("text-xs", isAcknowledged ? "text-blue-300/70" : "text-red-300/80")}>
            {validationReason}
          </p>
        </div>
      )}
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

      <div className="flex flex-col gap-1 pt-2 border-t border-border">
        <span className="text-xs font-semibold text-group-text">My Comments</span>
        <textarea
          value={paramNotes[selectedParam.name] ?? ""}
          onChange={(e) => setParamNote(selectedParam.name, e.target.value)}
          placeholder={username ? "Add your notes…" : "Sign in to save notes"}
          disabled={!username}
          rows={3}
          className="w-full resize-y rounded border border-border bg-secondary px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring font-sans disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <p className="text-[10px] text-muted-foreground/50">
          Auto-saved · included in description search
        </p>
      </div>
    </div>
  );
}
