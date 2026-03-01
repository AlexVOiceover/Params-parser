"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  Param,
  ProtectionList,
  ParamDefinition,
  ConsoleEntry,
  ParamNotes,
} from "@/lib/types";
import {
  parseParamFile,
  applyFilter,
  DEFAULT_PROTECTION_LISTS,
} from "@/lib/param-engine";
import {
  getStoredUsername,
  storeUsername,
  clearStoredUsername,
  sanitizeUsername,
} from "@/lib/user-store";

// ---------- helpers (module-level, no React deps) ----------

async function apiFetchLists(username: string): Promise<{ lists: ProtectionList[]; source: string; error?: string } | null> {
  try {
    const res = await fetch(`/api/lists/${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function apiSaveLists(username: string, lists: ProtectionList[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/lists/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lists),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function apiFetchNotes(username: string): Promise<ParamNotes> {
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(username)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.notes ?? {};
  } catch {
    return {};
  }
}

async function apiSaveNotes(username: string, notes: ParamNotes): Promise<void> {
  try {
    await fetch(`/api/notes/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notes),
    });
  } catch {
    // silent — notes are best-effort
  }
}

// ---------- types ----------

interface AppState {
  // User
  username: string | null;
  listsLoading: boolean;

  // File
  fileName: string;
  allParams: Param[];
  protectedParams: Param[];
  remainingParams: Param[];

  // Selection
  checkedProtected: Set<string>;
  checkedRemaining: Set<string>;

  // Protection lists
  protectionLists: ProtectionList[];
  activeListName: string;

  // Param definitions
  paramDefs: Record<string, ParamDefinition>;
  pdefGroups: string[];
  cacheAge: string;
  defsLoading: boolean;

  // Detail
  selectedParam: { name: string; value: string } | null;

  // Console
  consoleEntries: ConsoleEntry[];

  // Status
  statusMessage: string;

  // Whether the user has manually moved params away from the auto-filtered baseline
  isProtectionModified: boolean;

  // Per-param user notes
  paramNotes: ParamNotes;
}

interface AppActions {
  setUser: (name: string) => void;
  clearUser: () => void;
  loadFile: (name: string, content: string) => void;
  setActiveList: (name: string) => void;
  toggleCheckedProtected: (name: string) => void;
  toggleCheckedRemaining: (name: string) => void;
  toggleAllProtected: (checked: boolean) => void;
  toggleAllRemaining: (checked: boolean) => void;
  toggleGroupProtected: (paramNames: string[]) => void;
  toggleGroupRemaining: (paramNames: string[]) => void;
  moveCheckedToProtected: () => void;
  moveCheckedToRemaining: () => void;
  moveSingleToProtected: (name: string) => void;
  moveSingleToRemaining: (name: string) => void;
  moveBulkToProtected: (names: string[]) => void;
  moveBulkToRemaining: (names: string[]) => void;
  selectParam: (name: string, value: string) => void;
  setParamDefs: (
    defs: Record<string, ParamDefinition>,
    groups: string[],
    age: string
  ) => void;
  setDefsLoading: (loading: boolean) => void;
  setProtectionLists: (lists: ProtectionList[]) => void;
  setParamNote: (name: string, note: string) => void;
  createFromDefs: () => void;
  log: (message: string, level?: "INFO" | "WARN" | "ERROR") => void;
  clearConsole: () => void;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

// ---------- provider ----------

export function AppProvider({ children }: { children: ReactNode }) {
  // --- user ---
  const [username, setUsernameState] = useState<string | null>(null);
  const [listsLoading, setListsLoading] = useState(false);
  const usernameRef = useRef<string | null>(null);
  // true once the initial per-user list fetch (or skip) is done — prevents
  // saving defaults back to the server before we've loaded real data
  const listsReadyRef = useRef(false);

  // --- file ---
  const [fileName, setFileName] = useState("");
  const [allParams, setAllParams] = useState<Param[]>([]);
  const [protectedParams, setProtectedParams] = useState<Param[]>([]);
  const [remainingParams, setRemainingParams] = useState<Param[]>([]);

  // --- selection ---
  const [checkedProtected, setCheckedProtected] = useState<Set<string>>(new Set());
  const [checkedRemaining, setCheckedRemaining] = useState<Set<string>>(new Set());

  // --- protection lists ---
  const [protectionLists, setProtectionListsState] = useState<ProtectionList[]>(
    DEFAULT_PROTECTION_LISTS
  );
  const [activeListName, setActiveListName] = useState(
    DEFAULT_PROTECTION_LISTS[0]?.name ?? ""
  );

  // --- param defs ---
  const [paramDefs, setParamDefsState] = useState<Record<string, ParamDefinition>>({});
  const [pdefGroups, setPdefGroups] = useState<string[]>([]);
  const [cacheAge, setCacheAge] = useState("No cache");
  const [defsLoading, setDefsLoading] = useState(true);

  // --- notes ---
  const [paramNotes, setParamNotesState] = useState<ParamNotes>({});
  const paramNotesRef = useRef<ParamNotes>({});
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- ui ---
  const [selectedParam, setSelectedParam] = useState<{ name: string; value: string } | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [baselineProtectedNames, setBaselineProtectedNames] = useState<Set<string>>(new Set());

  // ---------- helpers ----------

  const log = useCallback(
    (message: string, level: "INFO" | "WARN" | "ERROR" = "INFO") => {
      const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setConsoleEntries((prev) => [...prev, { timestamp: ts, level, message }]);
    },
    []
  );

  const doFilter = useCallback(
    (params: Param[], listName: string, lists: ProtectionList[]) => {
      const list = lists.find((l) => l.name === listName);
      const rules = list?.rules ?? [];
      const { protected: p, remaining: r } = applyFilter(params, rules);
      setProtectedParams(p);
      setRemainingParams(r);
      setBaselineProtectedNames(new Set(p.map((x) => x.name)));
      setCheckedProtected(new Set());
      setCheckedRemaining(new Set());
      setSelectedParam(null);
      setStatusMessage(
        `${p.length} protected \u00B7 ${r.length} will be applied`
      );
      return { p, r };
    },
    []
  );

  // ---------- user management ----------

  const loadListsForUser = useCallback(async (u: string, logFn?: (msg: string, level?: "INFO" | "WARN" | "ERROR") => void) => {
    setListsLoading(true);
    const result = await apiFetchLists(u);
    setListsLoading(false);
    if (result) {
      if (result.lists.length > 0) {
        setProtectionListsState(result.lists);
        setActiveListName((prev) =>
          result.lists.some((l) => l.name === prev) ? prev : result.lists[0].name
        );
      }
      if (logFn) {
        if (result.source === "kv") {
          logFn(`Lists loaded from server (${result.lists.length} list${result.lists.length !== 1 ? "s" : ""})`);
        } else if (result.source === "defaults") {
          logFn(`No saved lists for '${u}' — using defaults`);
        } else {
          logFn(`Could not load lists from server: ${result.error ?? "unknown error"}`, "WARN");
        }
      }
    }
    listsReadyRef.current = true;
  }, []);

  const loadNotesForUser = useCallback(async (u: string) => {
    const notes = await apiFetchNotes(u);
    setParamNotesState(notes);
    paramNotesRef.current = notes;
  }, []);

  // On mount: restore username from localStorage
  useEffect(() => {
    const stored = getStoredUsername();
    if (stored) {
      usernameRef.current = stored;
      setUsernameState(stored);
      loadListsForUser(stored, log);
      loadNotesForUser(stored);
    } else {
      // No user — use defaults immediately, no API fetch needed
      listsReadyRef.current = true;
    }
  }, [loadListsForUser, loadNotesForUser, log]);

  const setUser = useCallback(
    (name: string) => {
      const clean = sanitizeUsername(name);
      storeUsername(clean);
      usernameRef.current = clean;
      setUsernameState(clean);
      listsReadyRef.current = false;
      loadListsForUser(clean, log).then(() => {
        log(`Signed in as '${clean}'`);
      });
      loadNotesForUser(clean);
    },
    [loadListsForUser, loadNotesForUser, log]
  );

  const clearUser = useCallback(() => {
    clearStoredUsername();
    usernameRef.current = null;
    setUsernameState(null);
    listsReadyRef.current = false;
    setParamNotesState({});
    paramNotesRef.current = {};
    log("Signed out — changes will not be persisted");
  }, [log]);

  const setParamNote = useCallback((name: string, note: string) => {
    setParamNotesState((prev) => {
      const next = { ...prev };
      if (note) {
        next[name] = note;
      } else {
        delete next[name];
      }
      paramNotesRef.current = next;
      return next;
    });
    // Debounced save — 1s after last keystroke
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    if (usernameRef.current) {
      notesTimerRef.current = setTimeout(() => {
        if (usernameRef.current) {
          apiSaveNotes(usernameRef.current, paramNotesRef.current);
        }
      }, 1000);
    }
  }, []);

  // ---------- file ----------

  const loadFile = useCallback(
    (name: string, content: string) => {
      const params = parseParamFile(content);
      setFileName(name);
      setAllParams(params);
      const { p, r } = doFilter(params, activeListName, protectionLists);
      log(
        `Opened '${name}' \u2014 ${params.length} params loaded. Filter '${activeListName}': ${p.length} protected, ${r.length} applied`
      );
    },
    [activeListName, protectionLists, doFilter, log]
  );

  const createFromDefs = useCallback(() => {
    const params: Param[] = Object.entries(paramDefs).map(([name, def]) => ({
      name,
      value: def.Default ?? "0",
    }));
    setFileName("new_config.param");
    setAllParams(params);
    setActiveListName("__no_filter__");
    const { protected: p, remaining: r } = applyFilter(params, []);
    setProtectedParams(p);
    setRemainingParams(r);
    setBaselineProtectedNames(new Set());
    setCheckedProtected(new Set());
    setCheckedRemaining(new Set());
    setSelectedParam(null);
    setStatusMessage(`${params.length} params loaded (values set to 0)`);
    log(`New config \u2014 ${params.length} params from pdef. Note: ArduPilot pdef.json has no default values, all set to 0`);
  }, [paramDefs, log]);

  // ---------- list selection ----------

  const setActiveList = useCallback(
    (name: string) => {
      setActiveListName(name);
      if (allParams.length > 0) {
        const { p, r } = doFilter(allParams, name, protectionLists);
        log(
          `Filter '${name}' \u2014 ${p.length} protected, ${r.length} will be applied`
        );
      }
    },
    [allParams, protectionLists, doFilter, log]
  );

  // ---------- checkboxes ----------

  const toggleCheckedProtected = useCallback((name: string) => {
    setCheckedProtected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleCheckedRemaining = useCallback((name: string) => {
    setCheckedRemaining((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAllProtected = useCallback(
    (checked: boolean) => {
      setCheckedProtected(
        checked ? new Set(protectedParams.map((p) => p.name)) : new Set()
      );
    },
    [protectedParams]
  );

  const toggleAllRemaining = useCallback(
    (checked: boolean) => {
      setCheckedRemaining(
        checked ? new Set(remainingParams.map((p) => p.name)) : new Set()
      );
    },
    [remainingParams]
  );

  const toggleGroupProtected = useCallback((paramNames: string[]) => {
    setCheckedProtected((prev) => {
      const next = new Set(prev);
      const allChecked = paramNames.every((n) => next.has(n));
      if (allChecked) paramNames.forEach((n) => next.delete(n));
      else paramNames.forEach((n) => next.add(n));
      return next;
    });
  }, []);

  const toggleGroupRemaining = useCallback((paramNames: string[]) => {
    setCheckedRemaining((prev) => {
      const next = new Set(prev);
      const allChecked = paramNames.every((n) => next.has(n));
      if (allChecked) paramNames.forEach((n) => next.delete(n));
      else paramNames.forEach((n) => next.add(n));
      return next;
    });
  }, []);

  // ---------- move params ----------

  const moveCheckedToProtected = useCallback(() => {
    if (checkedRemaining.size === 0) return;
    const toMove = remainingParams.filter((p) => checkedRemaining.has(p.name));
    const names = new Set(toMove.map((p) => p.name));
    setRemainingParams((prev) => prev.filter((p) => !names.has(p.name)));
    setProtectedParams((prev) => [...prev, ...toMove]);
    setCheckedRemaining(new Set());
    const preview =
      toMove.slice(0, 4).map((p) => p.name).join(", ") +
      (toMove.length > 4 ? " ..." : "");
    log(`Moved ${toMove.length} param(s) to Protected: ${preview}`);
  }, [checkedRemaining, remainingParams, log]);

  const moveCheckedToRemaining = useCallback(() => {
    if (checkedProtected.size === 0) return;
    const toMove = protectedParams.filter((p) => checkedProtected.has(p.name));
    const names = new Set(toMove.map((p) => p.name));
    setProtectedParams((prev) => prev.filter((p) => !names.has(p.name)));
    setRemainingParams((prev) => [...prev, ...toMove]);
    setCheckedProtected(new Set());
    const preview =
      toMove.slice(0, 4).map((p) => p.name).join(", ") +
      (toMove.length > 4 ? " ..." : "");
    log(`Moved ${toMove.length} param(s) to Will Be Applied: ${preview}`);
  }, [checkedProtected, protectedParams, log]);

  const moveSingleToProtected = useCallback(
    (name: string) => {
      const param = remainingParams.find((p) => p.name === name);
      if (!param) return;
      setRemainingParams((prev) => prev.filter((p) => p.name !== name));
      setProtectedParams((prev) => [...prev, param]);
      log(`Moved '${name}' to Protected`);
    },
    [remainingParams, log]
  );

  const moveSingleToRemaining = useCallback(
    (name: string) => {
      const param = protectedParams.find((p) => p.name === name);
      if (!param) return;
      setProtectedParams((prev) => prev.filter((p) => p.name !== name));
      setRemainingParams((prev) => [...prev, param]);
      log(`Moved '${name}' to Will Be Applied`);
    },
    [protectedParams, log]
  );

  const moveBulkToProtected = useCallback(
    (names: string[]) => {
      const nameSet = new Set(names);
      const toMove = remainingParams.filter((p) => nameSet.has(p.name));
      if (toMove.length === 0) return;
      setRemainingParams((prev) => prev.filter((p) => !nameSet.has(p.name)));
      setProtectedParams((prev) => [...prev, ...toMove]);
      log(`Moved ${toMove.length} param(s) to Protected`);
    },
    [remainingParams, log]
  );

  const moveBulkToRemaining = useCallback(
    (names: string[]) => {
      const nameSet = new Set(names);
      const toMove = protectedParams.filter((p) => nameSet.has(p.name));
      if (toMove.length === 0) return;
      setProtectedParams((prev) => prev.filter((p) => !nameSet.has(p.name)));
      setRemainingParams((prev) => [...prev, ...toMove]);
      log(`Moved ${toMove.length} param(s) to Will Be Applied`);
    },
    [protectedParams, log]
  );

  // ---------- misc ----------

  const selectParam = useCallback((name: string, value: string) => {
    setSelectedParam({ name, value });
  }, []);

  const setParamDefs = useCallback(
    (defs: Record<string, ParamDefinition>, groups: string[], age: string) => {
      setParamDefsState(defs);
      setPdefGroups(groups);
      setCacheAge(age);
    },
    []
  );

  const clearConsole = useCallback(() => {
    setConsoleEntries([]);
  }, []);

  // ---------- protection list mutations (auto-saves to KV) ----------

  const updateProtectionLists = useCallback(
    (lists: ProtectionList[]) => {
      setProtectionListsState(lists);
      if (allParams.length > 0) {
        doFilter(allParams, activeListName, lists);
      }
      // Persist — only after the initial fetch completed, and only if signed in
      if (listsReadyRef.current && usernameRef.current) {
        apiSaveLists(usernameRef.current, lists).then((result) => {
          if (result.ok) {
            log(`Lists saved to server`);
          } else {
            log(`Lists save failed: ${result.error ?? "unknown error"}`, "WARN");
          }
        });
      }
    },
    [allParams, activeListName, doFilter, log]
  );

  // ---------- render ----------

  return (
    <AppContext.Provider
      value={{
        username,
        listsLoading,
        fileName,
        allParams,
        protectedParams,
        remainingParams,
        checkedProtected,
        checkedRemaining,
        protectionLists,
        activeListName,
        paramDefs,
        pdefGroups,
        cacheAge,
        defsLoading,
        selectedParam,
        consoleEntries,
        statusMessage,
        isProtectionModified:
          protectedParams.length > 0 &&
          (protectedParams.length !== baselineProtectedNames.size ||
            protectedParams.some((p) => !baselineProtectedNames.has(p.name))),
        setUser,
        clearUser,
        loadFile,
        createFromDefs,
        setActiveList,
        toggleCheckedProtected,
        toggleCheckedRemaining,
        toggleAllProtected,
        toggleAllRemaining,
        toggleGroupProtected,
        toggleGroupRemaining,
        moveCheckedToProtected,
        moveCheckedToRemaining,
        moveSingleToProtected,
        moveSingleToRemaining,
        moveBulkToProtected,
        moveBulkToRemaining,
        selectParam,
        setParamDefs,
        setDefsLoading,
        setProtectionLists: updateProtectionLists,
        paramNotes,
        setParamNote,
        log,
        clearConsole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
