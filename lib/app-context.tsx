"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Param,
  ProtectionList,
  ParamDefinition,
  ConsoleEntry,
} from "@/lib/types";
import {
  parseParamFile,
  applyFilter,
  DEFAULT_PROTECTION_LISTS,
} from "@/lib/param-engine";

interface AppState {
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
}

interface AppActions {
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
  selectParam: (name: string, value: string) => void;
  setParamDefs: (
    defs: Record<string, ParamDefinition>,
    groups: string[],
    age: string
  ) => void;
  setDefsLoading: (loading: boolean) => void;
  setProtectionLists: (lists: ProtectionList[]) => void;
  log: (message: string, level?: "INFO" | "WARN" | "ERROR") => void;
  clearConsole: () => void;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [fileName, setFileName] = useState("");
  const [allParams, setAllParams] = useState<Param[]>([]);
  const [protectedParams, setProtectedParams] = useState<Param[]>([]);
  const [remainingParams, setRemainingParams] = useState<Param[]>([]);
  const [checkedProtected, setCheckedProtected] = useState<Set<string>>(
    new Set()
  );
  const [checkedRemaining, setCheckedRemaining] = useState<Set<string>>(
    new Set()
  );
  const [protectionLists, setProtectionLists] = useState<ProtectionList[]>(
    DEFAULT_PROTECTION_LISTS
  );
  const [activeListName, setActiveListName] = useState(
    DEFAULT_PROTECTION_LISTS[0]?.name ?? ""
  );
  const [paramDefs, setParamDefsState] = useState<
    Record<string, ParamDefinition>
  >({});
  const [pdefGroups, setPdefGroups] = useState<string[]>([]);
  const [cacheAge, setCacheAge] = useState("No cache");
  const [defsLoading, setDefsLoading] = useState(true);
  const [selectedParam, setSelectedParam] = useState<{
    name: string;
    value: string;
  } | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Ready");

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
      if (allChecked) {
        paramNames.forEach((n) => next.delete(n));
      } else {
        paramNames.forEach((n) => next.add(n));
      }
      return next;
    });
  }, []);

  const toggleGroupRemaining = useCallback((paramNames: string[]) => {
    setCheckedRemaining((prev) => {
      const next = new Set(prev);
      const allChecked = paramNames.every((n) => next.has(n));
      if (allChecked) {
        paramNames.forEach((n) => next.delete(n));
      } else {
        paramNames.forEach((n) => next.add(n));
      }
      return next;
    });
  }, []);

  const moveCheckedToProtected = useCallback(() => {
    if (checkedRemaining.size === 0) return;
    const toMove = remainingParams.filter((p) => checkedRemaining.has(p.name));
    const names = new Set(toMove.map((p) => p.name));
    setRemainingParams((prev) => prev.filter((p) => !names.has(p.name)));
    setProtectedParams((prev) => [...prev, ...toMove]);
    setCheckedRemaining(new Set());
    const preview =
      toMove
        .slice(0, 4)
        .map((p) => p.name)
        .join(", ") + (toMove.length > 4 ? " ..." : "");
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
      toMove
        .slice(0, 4)
        .map((p) => p.name)
        .join(", ") + (toMove.length > 4 ? " ..." : "");
    log(`Moved ${toMove.length} param(s) to Will Be Applied: ${preview}`);
  }, [checkedProtected, protectedParams, log]);

  const selectParam = useCallback((name: string, value: string) => {
    setSelectedParam({ name, value });
  }, []);

  const setParamDefs = useCallback(
    (
      defs: Record<string, ParamDefinition>,
      groups: string[],
      age: string
    ) => {
      setParamDefsState(defs);
      setPdefGroups(groups);
      setCacheAge(age);
    },
    []
  );

  const clearConsole = useCallback(() => {
    setConsoleEntries([]);
  }, []);

  const updateProtectionLists = useCallback(
    (lists: ProtectionList[]) => {
      setProtectionLists(lists);
      if (allParams.length > 0) {
        doFilter(allParams, activeListName, lists);
      }
    },
    [allParams, activeListName, doFilter]
  );

  return (
    <AppContext.Provider
      value={{
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
        loadFile,
        setActiveList,
        toggleCheckedProtected,
        toggleCheckedRemaining,
        toggleAllProtected,
        toggleAllRemaining,
        toggleGroupProtected,
        toggleGroupRemaining,
        moveCheckedToProtected,
        moveCheckedToRemaining,
        selectParam,
        setParamDefs,
        setDefsLoading,
        setProtectionLists: updateProtectionLists,
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
