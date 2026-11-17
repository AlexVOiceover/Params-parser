"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/styles";

function DroneIcon({ className }: { className?: string }) {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" className={className}>
      <line x1="18" y1="12" x2="7"  y2="5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="29" y2="5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="7"  y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="29" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7"  cy="5"  r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="29" cy="5"  r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7"  cy="19" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="29" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ---------- useLongPress ----------

export function useLongPress(onLongPress: () => void, duration = 2000, pressDelay = 0) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      completedRef.current = false;
      timerRef.current = setTimeout(() => {
        completedRef.current = true;
        callbackRef.current();
        setPressing(false);
      }, duration);
      if (pressDelay > 0) {
        delayRef.current = setTimeout(() => setPressing(true), pressDelay);
      } else {
        setPressing(true);
      }
    },
    [duration, pressDelay]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (delayRef.current) clearTimeout(delayRef.current);
    setPressing(false);
  }, []);

  return {
    pressing,
    completedRef,
    fillDuration: duration - pressDelay,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
    },
  };
}

// ---------- ValueCell ----------

export function ValueCell({
  originalValue,
  override,
  onOverride,
  isInvalid,
  isAcknowledged,
  className,
}: {
  originalValue: string;
  override: string | undefined;
  onOverride: (value: string) => void;
  isInvalid?: boolean;
  isAcknowledged?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEdit = useCallback(() => setEditing(true), []);
  const lp = useLongPress(openEdit, 1000, 300);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const hasOverride = override !== undefined && override !== "";

  const stopClick = (e: React.MouseEvent) => e.stopPropagation();

  const original = hasOverride && (
    <span className="relative pt-1 font-mono text-[11px] leading-none tabular-nums text-muted-foreground line-through">
      {originalValue}
    </span>
  );

  if (editing) {
    return (
      <div
        className={cn("flex flex-col items-end gap-0.5 pl-1", className)}
        onClick={stopClick}
      >
        {original}
        <input
          ref={inputRef}
          type="text"
          aria-label="Override value"
          value={override ?? ""}
          onChange={(e) => onOverride(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false);
          }}
          placeholder={originalValue}
          className={cn(fieldClass, "h-7 w-full rounded-md px-2 text-right font-mono text-[13px] tabular-nums")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none flex-col items-end gap-0.5 overflow-hidden rounded-md px-2 hover:bg-secondary",
        className
      )}
      title="Hold to override value"
      onClick={stopClick}
      {...lp.handlers}
    >
      {lp.pressing && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-primary/15" />
          <div
            className="pointer-events-none absolute z-10 flex items-center"
            style={{ top: 0, bottom: 0, animation: `dronefly ${lp.fillDuration}ms linear forwards` }}
          >
            <DroneIcon className="text-primary" />
          </div>
        </>
      )}
      {original}
      <span
        className={cn(
          "relative flex h-7 items-center gap-1 font-mono text-[13px] tabular-nums",
          isInvalid
            ? isAcknowledged ? "text-blue-700 dark:text-blue-400" : "text-red-700 dark:text-red-400"
            : hasOverride ? "text-amber-700 dark:text-amber-400" : "text-foreground"
        )}
      >
        {isInvalid && (isAcknowledged
          ? <CircleCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
          : <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden="true" />)}
        {hasOverride ? override : originalValue}
      </span>
    </div>
  );
}
