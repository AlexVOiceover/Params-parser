/**
 * Transient .param file used as an extra column in Compare.
 *
 * Held in sessionStorage only — it is never uploaded or written to the DB, and
 * disappears when the tab closes. Used to diff a param set received by email
 * against what the catalog holds, without keeping the file.
 */

/** Virtual version ID used in compare URLs to represent the picked file. */
export const FILE_VERSION_ID = "__file__";
export const FILE_STORAGE_KEY = "air6_compare_file";

export interface CompareFilePayload {
  /** Original filename, shown as the column label. */
  name: string;
  params: { name: string; value: string }[];
}

export function readCompareFile(): CompareFilePayload | null {
  try {
    const raw = sessionStorage.getItem(FILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompareFilePayload;
    if (parsed && typeof parsed.name === "string" && Array.isArray(parsed.params) && parsed.params.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

export function writeCompareFile(payload: CompareFilePayload): void {
  try { sessionStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

export function clearCompareFile(): void {
  try { sessionStorage.removeItem(FILE_STORAGE_KEY); } catch {}
}
