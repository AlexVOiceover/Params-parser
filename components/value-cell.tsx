"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, CircleCheck, Pencil, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/styles";

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
  // What the override was when editing started, so Escape can put it back.
  const before = useRef("");

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const hasOverride = override !== undefined && override !== "";

  // The old value sits to the left of the new one, struck through, with an arrow between them.
  const original = hasOverride && (
    <>
      <span className="relative min-w-0 truncate font-mono text-[13px] tabular-nums text-muted-foreground line-through" title={`Was ${originalValue}`}>
        {originalValue}
      </span>
      <ArrowRight className="relative h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  if (editing) {
    return (
      <div className={cn("flex h-7 items-center justify-end gap-1.5 pl-1", className)} onClick={(e) => e.stopPropagation()}>
        {original}
        <input
          ref={inputRef}
          type="text"
          aria-label="New value"
          value={override ?? ""}
          onChange={(e) => onOverride(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(false);
            if (e.key === "Escape") {
              onOverride(before.current);
              setEditing(false);
            }
          }}
          placeholder={originalValue}
          className={cn(fieldClass, "h-7 w-28 shrink-0 rounded-md px-2 text-right font-mono text-[13px] tabular-nums")}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Click to change the value. Leave it empty to keep the original."
      onClick={() => {
        before.current = override ?? "";
        setEditing(true);
      }}
      className={cn(
        "group/value relative flex cursor-text items-center justify-end gap-1.5 overflow-hidden rounded-md px-2 hover:bg-secondary hover:ring-1 hover:ring-border",
        className
      )}
    >
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/value:opacity-100" aria-hidden="true" />
      {original}
      <span
        className={cn(
          "relative flex h-7 shrink-0 items-center gap-1 font-mono text-[13px] tabular-nums whitespace-nowrap",
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
    </button>
  );
}
