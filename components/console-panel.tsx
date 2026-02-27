"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

export function ConsolePanel() {
  const { consoleEntries, clearConsole } = useApp();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleEntries]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-xs font-semibold text-foreground">Console</span>
        <button
          onClick={clearConsole}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground border border-border hover:bg-secondary transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-console-bg p-2 min-h-0">
        {consoleEntries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No log entries yet
          </p>
        )}
        {consoleEntries.map((entry, i) => (
          <div key={i} className="font-mono text-[11px] leading-relaxed">
            <span className="text-muted-foreground">[{entry.timestamp}]</span>{" "}
            <span
              className={cn(
                entry.level === "ERROR" && "text-destructive-foreground",
                entry.level === "WARN" && "text-yellow-400",
                entry.level === "INFO" && "text-console-text"
              )}
            >
              {entry.level}:
            </span>{" "}
            <span className="text-console-text">{entry.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
