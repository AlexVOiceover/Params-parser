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
  Default?: string;
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

export type ParamNotes = Record<string, string>;

// ── Catalog types (Supabase) ──────────────────────────────────────────────

export interface DroneType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface ParamSet {
  id: string;
  name: string;
  description: string | null;
  drone_type_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParamVersion {
  id: string;
  param_set_id: string;
  version_label: string;
  storage_path: string;
  changelog: string | null;
  created_by: string | null;
  created_at: string;
  is_latest: boolean;
}
