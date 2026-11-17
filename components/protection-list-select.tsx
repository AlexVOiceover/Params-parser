"use client";

import { useId } from "react";
import { useApp } from "@/lib/app-context";
import { fieldClass, labelClass } from "@/components/ui/styles";

const EDIT_SENTINEL = "__edit_lists__";
const NO_FILTER_SENTINEL = "__no_filter__";

interface Props {
  onEditLists: () => void;
}

export function ProtectionListSelect({ onEditLists }: Props) {
  const { protectionLists, activeListName, setActiveList } = useApp();
  const selectId = useId();

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
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={selectId} className={`${labelClass} whitespace-nowrap`}>
        Protection list:
      </label>
      <select
        id={selectId}
        value={activeListName}
        onChange={handleChange}
        className={`${fieldClass} min-w-0 flex-1 cursor-pointer truncate sm:flex-none`}
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
