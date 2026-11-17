"use client";

import { useRef } from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { buttonClass } from "@/components/ui/styles";

export function FileUpload({ onFileLoaded, className }: { onFileLoaded?: () => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { loadFile } = useApp();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      loadFile(file.name, content);
      onFileLoaded?.();
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".param,.parm"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(buttonClass("secondary", "md"), className)}
      >
        <FolderOpen className="h-4 w-4" />
        Open .param
      </button>
    </>
  );
}
