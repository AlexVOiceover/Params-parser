"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";
import { sanitizeUsername, isValidUsername } from "@/lib/user-store";

interface Props {
  onConfirm: (username: string) => void;
}

export function UsernamePrompt({ onConfirm }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sanitized = sanitizeUsername(value);
  const valid = isValidUsername(value);
  const showSanitized = valid && sanitized !== value.trim();

  function handleSubmit() {
    if (!valid) return;
    onConfirm(sanitized);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border bg-toolbar px-5 py-4">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            Choose a Username
          </h2>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Your protection lists will be saved and synced across devices under
            your username.
          </p>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g. alex or team_alpha"
            maxLength={24}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          {value.trim() !== "" && !valid && (
            <p className="text-xs text-destructive">
              Must be 2–20 characters: letters, numbers, underscore, dash.
            </p>
          )}
          {showSanitized && (
            <p className="text-xs text-muted-foreground">
              Will be saved as:{" "}
              <span className="font-mono font-medium text-foreground">
                {sanitized}
              </span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border bg-toolbar px-5 py-3">
          <button
            onClick={handleSubmit}
            disabled={!valid}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
