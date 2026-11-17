"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { buttonClass } from "@/components/ui/styles";

const LEVEL_CLASS = {
  INFO: "text-console-text",
  WARN: "text-amber-700 dark:text-yellow-400",
  ERROR: "text-red-700 dark:text-red-400",
} as const;

export function ConsolePanel() {
  const { consoleEntries, clearConsole } = useApp();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleEntries]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-0.5 pl-4 pr-1.5">
        <h2 className="text-[13px] font-semibold text-foreground">Console</h2>
        <button type="button" onClick={clearConsole} className={buttonClass("ghost", "sm")}>
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/40 px-4 py-2 dark:bg-console-bg">
        {consoleEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No log entries yet
          </p>
        )}
        {consoleEntries.map((entry, i) => (
          <div key={i} className="font-mono text-xs leading-relaxed">
            <span className="text-muted-foreground">[{entry.timestamp}]</span>{" "}
            <span className={cn("font-medium", LEVEL_CLASS[entry.level])}>
              {entry.level}:
            </span>{" "}
            <span className={entry.level === "INFO" ? "text-foreground/85" : LEVEL_CLASS[entry.level]}>
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
