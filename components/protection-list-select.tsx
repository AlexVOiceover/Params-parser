"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";

interface ProtectionListSelectProps {
  onEditLists: () => void;
}

export function ProtectionListSelect({ onEditLists }: ProtectionListSelectProps) {
  const { protectionLists, activeListName, setActiveList } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none hover:bg-accent transition-colors focus:ring-1 focus:ring-ring"
      >
        <span className="text-muted-foreground whitespace-nowrap">Protection list:</span>
        <span className="font-medium">{activeListName}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="py-1">
            {protectionLists.map((pl) => (
              <button
                key={pl.name}
                onClick={() => {
                  setActiveList(pl.name);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm transition-colors text-left",
                  pl.name === activeListName
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                {pl.name}
              </button>
            ))}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => {
                setOpen(false);
                onEditLists();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Edit Lists...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
