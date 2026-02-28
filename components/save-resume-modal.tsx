"use client";

import { useState } from "react";
import { Lock, Download, X, Shield, ChevronDown, ChevronRight } from "lucide-react";
import type { Param } from "@/lib/types";

interface SaveResumeModalProps {
  protectedParams: Param[];
  remainingParams: Param[];
  fileName: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function SaveResumeModal({
  protectedParams,
  remainingParams,
  fileName,
  onConfirm,
  onClose,
}: SaveResumeModalProps) {
  const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
  const [protectedOpen, setProtectedOpen] = useState(true);
  const [appliedOpen, setAppliedOpen] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Save Summary — {baseName}_filtered.param
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-toolbar">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground w-8" />
                <th className="text-left px-2 py-2 font-semibold text-muted-foreground font-mono">
                  Parameter
                </th>
                <th className="text-right px-4 py-2 font-semibold text-muted-foreground font-mono">
                  Value
                </th>
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Protected section */}
              {protectedParams.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="bg-protected/20 border-y border-border">
                      <button
                        onClick={() => setProtectedOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-protected/30 transition-colors"
                      >
                        {protectedOpen ? (
                          <ChevronDown className="h-3 w-3 text-protected-text shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-protected-text shrink-0" />
                        )}
                        <Lock className="h-3 w-3 text-protected-text shrink-0" />
                        <span className="text-[10px] font-semibold text-protected-text uppercase tracking-wider">
                          Protected — will NOT be written ({protectedParams.length})
                        </span>
                      </button>
                    </td>
                  </tr>
                  {protectedOpen &&
                    protectedParams.map((p) => (
                      <tr
                        key={`protected-${p.name}`}
                        className="border-b border-border/40 bg-protected/5 hover:bg-protected/15 transition-colors"
                      >
                        <td className="px-4 py-1.5 text-center">
                          <Lock className="h-3 w-3 text-red-400 mx-auto" />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-red-400">{p.name}</td>
                        <td className="px-4 py-1.5 font-mono text-right text-red-400/80 tabular-nums">
                          {p.value}
                        </td>
                        <td className="px-4 py-1.5 text-red-400/70">Skipped</td>
                      </tr>
                    ))}
                </>
              )}

              {/* Applied section */}
              {remainingParams.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="bg-applied/20 border-y border-border">
                      <button
                        onClick={() => setAppliedOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-applied/30 transition-colors"
                      >
                        {appliedOpen ? (
                          <ChevronDown className="h-3 w-3 text-applied-text shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-applied-text shrink-0" />
                        )}
                        <Shield className="h-3 w-3 text-applied-text shrink-0" />
                        <span className="text-[10px] font-semibold text-applied-text uppercase tracking-wider">
                          Will be applied ({remainingParams.length})
                        </span>
                      </button>
                    </td>
                  </tr>
                  {appliedOpen &&
                    remainingParams.map((p) => (
                      <tr
                        key={`applied-${p.name}`}
                        className="border-b border-border/40 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-4 py-1.5" />
                        <td className="px-2 py-1.5 font-mono text-foreground">{p.name}</td>
                        <td className="px-4 py-1.5 font-mono text-right text-muted-foreground tabular-nums">
                          {p.value}
                        </td>
                        <td className="px-4 py-1.5 text-applied-text/80">Write</td>
                      </tr>
                    ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-toolbar px-5 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{remainingParams.length}</span> params
            written,{" "}
            <span className="font-semibold text-red-400">{protectedParams.length}</span> protected
            params removed
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
