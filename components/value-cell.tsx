"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

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
  className,
}: {
  originalValue: string;
  override: string | undefined;
  onOverride: (value: string) => void;
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

  if (editing) {
    return (
      <div
        className={cn("px-2 py-0.5 flex flex-col items-end justify-center gap-0.5", className)}
        onClick={stopClick}
      >
        {hasOverride && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50 line-through leading-none">
            {originalValue}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={override ?? ""}
          onChange={(e) => onOverride(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false);
          }}
          placeholder={originalValue}
          className="w-full bg-transparent border-b border-primary/60 outline-none font-mono text-xs text-foreground placeholder:text-muted-foreground/30 tabular-nums"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-2 py-1 relative overflow-hidden select-none cursor-pointer hover:bg-secondary/30 flex flex-col items-end justify-center gap-0.5",
        className
      )}
      title="Hold to override value"
      onClick={stopClick}
      {...lp.handlers}
    >
      {lp.pressing && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            animation: "longPressFill 1s linear forwards",
            transformOrigin: "left center",
            background: "rgba(59,130,246,0.15)",
          }}
        />
      )}
      {hasOverride && (
        <span className="relative font-mono text-[10px] tabular-nums text-muted-foreground/50 line-through leading-none">
          {originalValue}
        </span>
      )}
      <span
        className={cn(
          "relative font-mono text-xs tabular-nums",
          hasOverride ? "text-amber-400" : "text-muted-foreground"
        )}
      >
        {hasOverride ? override : originalValue}
      </span>
    </div>
  );
}
