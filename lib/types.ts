// Types for the param filter application

export interface Param {
  name: string;
  value: string;
}

export interface Rule {
  type: "exact" | "prefix";
  value: string;
}

export interface ProtectionList {
  name: string;
  description: string;
  rules: Rule[];
}

export interface ParamDefinition {
  DisplayName?: string;
  Description?: string;
  Units?: string;
  Range?: { low: string; high: string };
  Values?: Record<string, string>;
  Bitmask?: Record<string, string>;
  RebootRequired?: string;
}

export interface ParamGroup {
  label: string;
  params: Param[];
}

export interface ConsoleEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}
