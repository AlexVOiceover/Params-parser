"use client";

import { useId } from "react";
import { TriangleAlert, CircleCheck, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/components/auth-provider";
import { validateParam } from "@/lib/param-engine";
import { buttonClass, labelClass, textareaClass } from "@/components/ui/styles";
import type { ParamDefinition } from "@/lib/types";

const fieldLabelClass = "text-xs font-medium text-muted-foreground";

export function DetailPanel() {
  const { selectedParam, paramDefs, paramNotes, setParamNote, acknowledgedInvalid, acknowledgeParam } = useApp();
  const { user } = useAuth();
  const notesId = useId();

  if (!selectedParam) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-muted-foreground">
        Click a parameter to see details
      </div>
    );
  }

  const meta: ParamDefinition = paramDefs[selectedParam.name] ?? {};
  const validationReason = Object.keys(meta).length ? validateParam(selectedParam.value, meta) : null;
  const isAcknowledged = acknowledgedInvalid.has(selectedParam.name);
  const validationTone = isAcknowledged ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300";

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {validationReason && (
        <div className={cn(
          "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5",
          isAcknowledged ? "border-blue-500/30 bg-blue-500/10" : "border-red-500/30 bg-red-500/10"
        )}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", validationTone)}>
              {isAcknowledged
                ? <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                : <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              }
              {isAcknowledged ? "Acknowledged" : "Value out of specification"}
            </span>
            <button
              type="button"
              onClick={() => acknowledgeParam(selectedParam.name)}
              className={buttonClass("secondary", "sm")}
            >
              {isAcknowledged ? "Undo" : "Acknowledge"}
            </button>
          </div>
          <p className={cn("text-xs", validationTone)}>
            {validationReason}
          </p>
        </div>
      )}
      <div>
        <h3 className="break-all font-mono text-sm font-semibold text-foreground">
          {selectedParam.name}
        </h3>
        <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
          Value: {selectedParam.value}
        </p>
      </div>

      {meta.DisplayName && (
        <div>
          <span className={fieldLabelClass}>Label</span>
          <p className="text-[13px] text-foreground">{meta.DisplayName}</p>
        </div>
      )}

      {meta.Description && (
        <div>
          <span className={fieldLabelClass}>
            Description
          </span>
          <p className="text-[13px] leading-relaxed text-foreground">
            {meta.Description}
          </p>
        </div>
      )}

      {meta.Units && (
        <div>
          <span className={fieldLabelClass}>Units</span>
          <p className="text-[13px] text-foreground">{meta.Units}</p>
        </div>
      )}

      {meta.Range && (
        <div>
          <span className={fieldLabelClass}>Range</span>
          <p className="font-mono text-xs text-foreground">
            {meta.Range.low} &ndash; {meta.Range.high}
          </p>
        </div>
      )}

      {meta.Values && Object.keys(meta.Values).length > 0 && (
        <div>
          <span className={fieldLabelClass}>
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
          <span className={fieldLabelClass}>
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
        <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          <Power className="h-3.5 w-3.5 shrink-0" />
          Reboot required after change
        </div>
      )}

      {!meta.DisplayName && !meta.Description && (
        <p className="text-xs italic text-muted-foreground">
          No definition found in ArduPilot database
        </p>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <label htmlFor={notesId} className={labelClass}>My Comments</label>
        <textarea
          id={notesId}
          value={paramNotes[selectedParam.name] ?? ""}
          onChange={(e) => setParamNote(selectedParam.name, e.target.value)}
          placeholder={user ? "Add your notes…" : "Sign in to save notes"}
          disabled={!user}
          rows={3}
          className={`${textareaClass} w-full resize-y`}
        />
        <p className="text-xs text-muted-foreground">
          Auto-saved · included in description search
        </p>
      </div>
    </div>
  );
}
