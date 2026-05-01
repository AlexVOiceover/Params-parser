"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { CHANGELOG } from "@/lib/changelog";

interface Props {
  onClose: () => void;
}

export function WhatsNewDialog({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-toolbar">
          <h2 className="text-sm font-semibold text-foreground">
            What&rsquo;s new <span className="text-muted-foreground font-mono text-xs ml-1.5">v{CHANGELOG[0].version}</span>
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {CHANGELOG.map((release) => (
            <section key={release.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm font-semibold text-primary font-mono">v{release.version}</span>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>
              <ul className="flex flex-col gap-1.5 list-disc list-outside pl-5 text-xs text-foreground leading-relaxed">
                {release.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
