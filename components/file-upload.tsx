"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { useApp } from "@/lib/app-context";

export function FileUpload({ onFileLoaded }: { onFileLoaded?: () => void }) {
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
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
      >
        <Upload className="h-4 w-4" />
        Open .param File
      </button>
    </>
  );
}
