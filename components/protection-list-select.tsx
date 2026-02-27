"use client";

import { useApp } from "@/lib/app-context";

export function ProtectionListSelect() {
  const { protectionLists, activeListName, setActiveList } = useApp();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Protection list:
      </span>
      <select
        value={activeListName}
        onChange={(e) => setActiveList(e.target.value)}
        className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {protectionLists.map((pl) => (
          <option key={pl.name} value={pl.name}>
            {pl.name}
          </option>
        ))}
      </select>
    </div>
  );
}
