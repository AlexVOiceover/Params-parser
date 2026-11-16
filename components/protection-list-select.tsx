"use client";

import { useApp } from "@/lib/app-context";

const EDIT_SENTINEL = "__edit_lists__";
const NO_FILTER_SENTINEL = "__no_filter__";

interface Props {
  onEditLists: () => void;
}

export function ProtectionListSelect({ onEditLists }: Props) {
  const { protectionLists, activeListName, setActiveList } = useApp();

  const globalLists = protectionLists.filter((l) => l.isGlobal);
  const userLists = protectionLists.filter((l) => !l.isGlobal);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === EDIT_SENTINEL) {
      e.target.value = activeListName;
      onEditLists();
    } else {
      setActiveList(e.target.value);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Protection list:
      </span>
      <select
        value={activeListName}
        onChange={handleChange}
        className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
      >
        {globalLists.length > 0 ? (
          <>
            <optgroup label="Global">
              {globalLists.map((pl) => (
                <option key={pl.name} value={pl.name}>{pl.name}</option>
              ))}
            </optgroup>
            {userLists.length > 0 && (
              <optgroup label="My Lists">
                {userLists.map((pl) => (
                  <option key={pl.name} value={pl.name}>{pl.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="──────────────">
              <option value={NO_FILTER_SENTINEL}>No Filter</option>
            </optgroup>
          </>
        ) : (
          <>
            {protectionLists.map((pl) => (
              <option key={pl.name} value={pl.name}>{pl.name}</option>
            ))}
            <option value={NO_FILTER_SENTINEL}>No Filter</option>
          </>
        )}
        <option disabled value="">──────────────</option>
        <option value={EDIT_SENTINEL}>✏  Edit Lists…</option>
      </select>
    </div>
  );
}
