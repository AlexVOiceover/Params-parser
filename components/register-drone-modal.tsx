"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDroneParams } from "@/lib/drone-params-context";
import { clearDroneMatchCache } from "@/lib/use-connected-drone-match";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import { WriteNFCButton } from "@/components/write-nfc-button";
import { parseSerialId, RUNTIME_PARAMS } from "@/lib/param-engine";
import { flashParamsToDrone, type FlashTarget } from "@/lib/drone-flash-engine";
import type { ParamWriteResult } from "@/lib/mavlink-serial";


type Stage = "form" | "confirm" | "flashing" | "done" | "error";

interface FamilyRow { id: string; name: string; slug: string; }
interface VariantRow { id: string; name: string; family_id: string; }
interface ClientRow { id: string; name: string; }

interface DroneInDB {
  id: string;
  serial: string;
  variant_id: string;
  client_id: string | null;
  familySlug: string | null;
  familyName: string | null;
  variantName: string | null;
  clientName: string | null;
}

export type RegisterMode = "flash" | "capture";

interface Props {
  onClose: () => void;
  /** Called when registration completes successfully (after user clicks Done). */
  onSuccess?: () => void;
  /**
   * "flash"   — overwrite drone with catalog Default (factory-fresh path)
   * "capture" — keep drone's current params, capture them as v1, only write
   *             SCR identifiers (curated/tuned drone path)
   */
  mode: RegisterMode;
}

const inputClass = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

/** Suggest a catalog-formatted serial: <PREFIX>-<MMYY>-<padded int>. */
function suggestCatalogSerial(familySlug: string | undefined, droneNum: number): string {
  const prefix = (familySlug ?? "DRN").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const padded = String(droneNum).padStart(4, "0");
  return `${prefix}-${mm}${yy}-${padded}`;
}

export function RegisterDroneModal({ onClose, onSuccess, mode }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { droneParams, setDroneParams } = useDroneParams();

  // Derive serial from SCR_USER1
  const scrUser1 = droneParams?.find((p) => p.name === "SCR_USER1");
  const scrUser1Val = scrUser1 ? parseInt(scrUser1.value, 10) : 0;
  const scrUser1IsSet = Number.isFinite(scrUser1Val) && scrUser1Val > 0;

  const [stage, setStage] = useState<Stage>("form");
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [serial, setSerial] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [clientId, setClientId] = useState("__orphan__");
  // Tracks whether the user has manually edited the serial; if they have, we
  // stop overwriting it with auto-suggestions when family changes.
  const [serialTouched, setSerialTouched] = useState(false);

  // Lookup data
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Drone-already-in-DB state
  const [existingDrone, setExistingDrone] = useState<DroneInDB | null>(null);
  const [checkingDB, setCheckingDB] = useState(false);
  const [fieldsLocked, setFieldsLocked] = useState(false);

  // Flash
  const [writeChanges, setWriteChanges] = useState<WriteChange[] | null>(null);
  const [flashTarget, setFlashTarget] = useState<FlashTarget>(new Map());
  const [newDroneId, setNewDroneId] = useState<string | null>(null);
  const [flashedVersion, setFlashedVersion] = useState<string>("1");

  // Load dropdown data
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("families").select("id, name, slug").order("name"),
      supabase.from("variants").select("id, name, family_id").order("name"),
      supabase.from("clients").select("id, name").order("name"),
    ]).then(([f, v, c]) => {
      setFamilies(f.data ?? []);
      setVariants(v.data ?? []);
      setClients(c.data ?? []);
      setLoaded(true);
    });
  }, []);

  // When serial is pre-filled from SCR_USER1, check DB immediately
  useEffect(() => {
    if (!scrUser1IsSet || !loaded) return;
    checkSerialInDB(String(scrUser1Val));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const checkSerialInDB = useCallback(async (serialStr: string) => {
    const id = parseSerialId(serialStr);
    if (!id) return;
    setCheckingDB(true);
    try {
      const res = await fetch(`/api/drone/match?id=${id}`);
      const body = await res.json();
      if (body.drone) {
        const d = body.drone;
        setExistingDrone({
          id: d.id,
          serial: d.serial,
          variant_id: d.variant_id,
          client_id: d.client_id,
          familySlug: d.family_slug,
          familyName: d.family_name,
          variantName: d.variant_name,
          clientName: d.client_name,
        });
        // Pre-fill and lock family/variant from DB; use the DB serial verbatim.
        setSerial(d.serial);
        setSerialTouched(true);
        if (d.variant_id) setVariantId(d.variant_id);
        const variantRow = (await createClient()!.from("variants").select("family_id").eq("id", d.variant_id).maybeSingle()).data;
        if (variantRow?.family_id) setFamilyId(variantRow.family_id);
        setFieldsLocked(true);
      } else {
        setExistingDrone(null);
        setFieldsLocked(false);
      }
    } finally {
      setCheckingDB(false);
    }
  }, []);

  const variantsForFamily = variants.filter((v) => v.family_id === familyId);

  // Auto-suggest the catalog serial from family slug + current MMYY + padded
  // SCR_USER1, unless the user has manually edited it or this is an existing drone.
  useEffect(() => {
    if (serialTouched || existingDrone) return;
    if (!scrUser1IsSet) return;
    const fam = families.find((f) => f.id === familyId);
    setSerial(suggestCatalogSerial(fam?.slug, scrUser1Val));
  }, [familyId, families, scrUser1IsSet, scrUser1Val, serialTouched, existingDrone]);

  function handleFamilyChange(fid: string) {
    setFamilyId(fid);
    setVariantId("");
  }

  async function handleConfirm() {
    if (!serial.trim() || !variantId) return;
    setStage("confirm");
  }

  async function ensureClientSet(droneId: string, supabase: ReturnType<typeof createClient>): Promise<string | null> {
    const isOrphanDrone = clientId === "__orphan__";
    const csRes = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        clientId: isOrphanDrone ? null : clientId,
        droneId,
        clientName: isOrphanDrone ? (serial.trim()) : (clients.find((c) => c.id === clientId)?.name ?? ""),
        serial: serial.trim(),
      }),
    });
    if (csRes.ok) {
      const newCs = await csRes.json() as { id?: string };
      return newCs.id ?? null;
    }
    if (csRes.status === 409) {
      const { data: existing } = await supabase!
        .from("client_sets")
        .select("id")
        .eq("drone_id", droneId)
        .eq("is_default", false)
        .maybeSingle();
      return existing?.id ?? null;
    }
    return null;
  }

  async function handleFlash() {
    setStage("flashing");
    setErrorMsg("");

    const supabase = createClient()!;

    // 1. Create drone row (or reuse existing) — same for both modes
    let droneId = existingDrone?.id ?? null;
    if (!droneId) {
      const res = await fetch("/api/admin/drones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial: serial.trim(),
          variantId,
          clientId: clientId === "__orphan__" ? null : clientId,
        }),
      });
      const body = await res.json();
      if (!res.ok) { setErrorMsg(body?.error ?? "Failed to create drone"); setStage("error"); return; }
      droneId = body.id;
    }
    setNewDroneId(droneId);

    if (mode === "capture") {
      // ── CAPTURE PATH — preserve drone's curated params ─────────────────
      // 1. Ensure a client_set for this drone (create or reuse)
      const targetClientSetId = droneId ? await ensureClientSet(droneId, supabase) : null;
      if (!targetClientSetId) {
        setErrorMsg("Failed to create param set for drone"); setStage("error"); return;
      }

      // 2. Compute next version label (max numeric + 1, or "1" if empty).
      //    Always capture — never skip — so the drone's actual state is
      //    recorded as a new version that becomes the latest.
      const { data: existingVersions } = await supabase
        .from("param_versions")
        .select("version_label")
        .eq("client_set_id", targetClientSetId);
      let nextNumeric = 1;
      for (const row of existingVersions ?? []) {
        const n = parseInt(row.version_label, 10);
        if (Number.isFinite(n) && n >= nextNumeric) nextNumeric = n + 1;
      }
      const captureVersionLabel = String(nextNumeric);

      const capRes = await fetch("/api/admin/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSetId: targetClientSetId,
          versionLabel: captureVersionLabel,
          params: droneParams ?? [],
          isLatest: true,
        }),
      });
      if (!capRes.ok) {
        const b = await capRes.json().catch(() => ({})) as { error?: string };
        setErrorMsg(b?.error ?? "Failed to capture params"); setStage("error"); return;
      }

      // 3. Build minimal write set: only the SCR identifiers
      const serialInt = parseSerialId(serial.trim());
      const droneMap = new Map((droneParams ?? []).map((p) => [p.name, parseFloat(p.value)]));
      const target = new Map<string, number>();
      target.set("SCR_ENABLE", 1);
      if (serialInt !== null) target.set("SCR_USER1", serialInt);
      target.set("SCR_USER2", nextNumeric);

      setFlashedVersion(captureVersionLabel);
      setFlashTarget(new Map(target));

      const diff: WriteChange[] = [];
      for (const [name, targetVal] of target.entries()) {
        const droneVal = droneMap.get(name);
        if (droneVal === undefined || Math.abs(droneVal - targetVal) >= 1e-5) {
          diff.push({ name, value: targetVal });
        }
      }
      if (diff.length === 0) { handleWriteSuccess([]); return; }
      setWriteChanges(diff);
      return;
    }

    // ── FLASH PATH — overwrite with catalog Default ──────────────────────
    // 2. Fetch Default param set for the variant
    const { data: defaultCS } = await supabase
      .from("client_sets")
      .select("id")
      .eq("variant_id", variantId)
      .eq("is_default", true)
      .maybeSingle();

    if (!defaultCS) {
      setErrorMsg("No Default param set found for this variant. Upload one first.");
      setStage("error");
      return;
    }

    const { data: latestPV } = await supabase
      .from("param_versions")
      .select("id, version_label")
      .eq("client_set_id", defaultCS.id)
      .eq("is_latest", true)
      .maybeSingle();

    if (!latestPV) {
      setErrorMsg("Default param set has no versions. Upload one first.");
      setStage("error");
      return;
    }

    // 3. Create client_set for this drone and clone Default v1 into it
    if (droneId) {
      const targetClientSetId = await ensureClientSet(droneId, supabase);
      if (!targetClientSetId) {
        setErrorMsg("Failed to create param set"); setStage("error"); return;
      }

      const { data: existingVersions } = await supabase
        .from("param_versions")
        .select("id")
        .eq("client_set_id", targetClientSetId)
        .limit(1);
      if (!existingVersions || existingVersions.length === 0) {
        await fetch(`/api/admin/param-versions/${latestPV.id}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId,
            clientSetId: targetClientSetId,
            versionLabel: latestPV.version_label,
          }),
        });
      }
    }

    // 4. Build full diff (Default params vs current drone params)
    const target = new Map<string, number>();
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from("param_values")
        .select("name, value")
        .eq("param_version_id", latestPV.id)
        .order("name")
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      for (const { name, value } of page) target.set(name, parseFloat(value));
      if (page.length < 1000) break;
    }

    target.set("SCR_ENABLE", 1);
    const serialInt = parseSerialId(serial.trim());
    if (serialInt !== null) target.set("SCR_USER1", serialInt);
    const versionInt = parseInt(latestPV.version_label, 10);
    if (Number.isFinite(versionInt)) target.set("SCR_USER2", versionInt);

    setFlashedVersion(latestPV.version_label);
    setFlashTarget(new Map(target));

    const droneMap = new Map((droneParams ?? []).map((p) => [p.name, parseFloat(p.value)]));
    const diff: WriteChange[] = [];
    const REGISTRATION_REQUIRED = new Set(["SCR_ENABLE", "SCR_USER1", "SCR_USER2"]);
    for (const [name, targetVal] of target.entries()) {
      if (RUNTIME_PARAMS.has(name) && !REGISTRATION_REQUIRED.has(name)) continue;
      const droneVal = droneMap.get(name);
      if (droneVal === undefined || Math.abs(droneVal - targetVal) / Math.max(Math.abs(targetVal), 1e-10) >= 1e-5) {
        diff.push({ name, value: targetVal });
      }
    }

    if (diff.length === 0) {
      handleWriteSuccess([]);
      return;
    }

    setWriteChanges(diff);
  }

  function handleWriteSuccess(written: ParamWriteResult[]) {
    if (droneParams && written.length > 0) {
      const writtenMap = new Map(written.map((r) => [r.name, r.actual ?? r.requested]));
      const existingNames = new Set(droneParams.map((p) => p.name));
      const updated = droneParams.map((p) => {
        const v = writtenMap.get(p.name);
        return v !== undefined ? { ...p, value: String(v) } : p;
      });
      // Append any newly-written params that weren't in the original snapshot.
      // (E.g. SCR_USER1 on a drone where scripting was previously disabled and
      //  the param wasn't exposed.) Without this, the match hook still reads
      //  the missing param as 0 and the drone shows as unregistered.
      for (const [name, value] of writtenMap.entries()) {
        if (!existingNames.has(name)) updated.push({ name, value: String(value) });
      }
      setDroneParams(updated);
    }
    setWriteChanges(null);
    clearDroneMatchCache();
    setStage("done");
    startTransition(() => router.refresh());
    // Fire-and-forget: mark drone as initialised in the DB
    if (newDroneId) {
      fetch(`/api/admin/drones/${newDroneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialisedAt: true }),
      }).catch(() => {});
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedFamily = families.find((f) => f.id === familyId);
  const selectedVariant = variants.find((v) => v.id === variantId);
  const isOrphan = clientId === "__orphan__";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => stage !== "flashing" && onClose()} />
        <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {mode === "capture" ? "Register & keep params" : "Register & flash defaults"}
              </h2>
              {stage !== "form" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  <span className="capitalize">{stage === "flashing" ? (mode === "capture" ? "Saving…" : "Flashing…") : stage}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={stage === "flashing"}
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

            {/* ── FORM ── */}
            {stage === "form" && (
              <>
                {existingDrone && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    This drone is already registered. You can still assign a client or re-flash the Default.
                  </div>
                )}

                {/* Drone-reported number (SCR_USER1) — info only */}
                {scrUser1IsSet && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">Drone reports (SCR_USER1)</span>
                    <span className="font-mono font-medium text-foreground">{scrUser1Val}</span>
                  </div>
                )}

                {/* Catalog serial — editable, auto-suggested */}
                <label className={labelClass}>
                  <span className={labelTextClass}>Catalog serial <span className="text-destructive">*</span></span>
                  {fieldsLocked ? (
                    <div className="font-mono text-sm text-foreground bg-secondary border border-border rounded-md px-3 py-2">
                      {serial}
                    </div>
                  ) : (
                    <input
                      required
                      value={serial}
                      onChange={(e) => { setSerial(e.target.value); setSerialTouched(true); }}
                      onBlur={(e) => e.target.value && checkSerialInDB(e.target.value)}
                      placeholder="e.g. AIR4-0426-0023"
                      className={inputClass + " font-mono"}
                    />
                  )}
                  {scrUser1IsSet && (() => {
                    const parsed = parseSerialId(serial);
                    if (parsed !== null && parsed !== scrUser1Val) {
                      return (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          Trailing number ({parsed}) doesn&apos;t match what the drone reports ({scrUser1Val})
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {checkingDB && <span className="text-[10px] text-muted-foreground">Checking database…</span>}
                </label>

                {/* Family */}
                <label className={labelClass}>
                  <span className={labelTextClass}>Family <span className="text-destructive">*</span></span>
                  {fieldsLocked ? (
                    <div className="font-mono text-sm text-muted-foreground bg-secondary/50 border border-border rounded-md px-3 py-2" title="Cannot change — edit in Clients & Drones">
                      {existingDrone?.familyName ?? selectedFamily?.name ?? "—"}
                    </div>
                  ) : (
                    <select
                      required
                      value={familyId}
                      onChange={(e) => handleFamilyChange(e.target.value)}
                      disabled={!loaded}
                      className={selectClass}
                    >
                      <option value="">Select family…</option>
                      {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                </label>

                {/* Variant */}
                {(familyId || fieldsLocked) && (
                  <label className={labelClass}>
                    <span className={labelTextClass}>Variant <span className="text-destructive">*</span></span>
                    {fieldsLocked ? (
                      <div className="font-mono text-sm text-muted-foreground bg-secondary/50 border border-border rounded-md px-3 py-2" title="Cannot change — edit in Clients & Drones">
                        {existingDrone?.variantName ?? selectedVariant?.name ?? "—"}
                      </div>
                    ) : (
                      <select
                        required
                        value={variantId}
                        onChange={(e) => setVariantId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select variant…</option>
                        {variantsForFamily.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    )}
                  </label>
                )}

                {/* Client */}
                {variantId && (
                  <label className={labelClass}>
                    <span className={labelTextClass}>Client</span>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="__orphan__">No client (orphan — tracks Default)</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      {isOrphan
                        ? "Drone will track the Default param set. Assign a client later from Clients & Drones."
                        : "A param set for this client will be created on this drone."}
                    </p>
                  </label>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
                  <button
                    onClick={handleConfirm}
                    disabled={!serial.trim() || !variantId}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* ── CONFIRM ── */}
            {stage === "confirm" && (
              <>
                <p className="text-sm text-muted-foreground">Review before {mode === "capture" ? "registering" : "registering and flashing"}:</p>
                <dl className="rounded-lg border border-border bg-secondary/30 divide-y divide-border text-sm">
                  {[
                    ["Serial", serial],
                    ["Family / Variant", `${selectedFamily?.name ?? existingDrone?.familyName ?? "?"} / ${selectedVariant?.name ?? existingDrone?.variantName ?? "?"}`],
                    ["Client", isOrphan ? "No client (orphan)" : (selectedClient?.name ?? "?")],
                    ["Action", mode === "capture"
                      ? "Capture current params as v1; write 3 SCR identifiers"
                      : (existingDrone ? "Re-flash Default to drone" : "Register drone + flash Default")],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between px-3 py-2 gap-3">
                      <dt className="text-muted-foreground shrink-0">{label}</dt>
                      <dd className={`text-right font-medium ${isOrphan && label === "Client" ? "text-muted-foreground italic font-normal" : "text-foreground"}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                {mode === "capture" ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      Drone&apos;s current params will be preserved. Only SCR_ENABLE, SCR_USER1, SCR_USER2 will be written. The captured params will be saved as v1 (marked for review).
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      The Default param set will be flashed to the drone, overwriting any tuning. Make sure the drone is safe (disarmed, no props).
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setStage("form")} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap">Back</button>
                  <button
                    onClick={handleFlash}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {mode === "capture" ? "Register & Keep params" : "Register & Flash"}
                  </button>
                </div>
              </>
            )}

            {/* ── FLASHING ── */}
            {stage === "flashing" && !writeChanges && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing…</p>
              </div>
            )}

            {/* ── DONE ── */}
            {stage === "done" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium text-foreground">Drone registered</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{serial}</span> is now registered.{" "}
                  {mode === "capture"
                    ? <>Current params captured as <span className="font-mono">v{flashedVersion}</span> (marked for review).</>
                    : <>Flashed with the Default param set (<span className="font-mono">v{flashedVersion}</span>).</>}
                </p>
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <WriteNFCButton
                    serial={serial}
                    label="Write NFC tag"
                    className="w-full justify-center"
                  />
                  <p className="text-[10px] text-muted-foreground">Write the serial to the NFC sticker on the drone</p>
                </div>
                <button
                  onClick={() => { onSuccess?.(); onClose(); }}
                  className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Done
                </button>
              </div>
            )}

            {/* ── ERROR ── */}
            {stage === "error" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">{errorMsg || "An error occurred."}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap">Close</button>
                  <button onClick={() => { setStage("form"); setErrorMsg(""); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap">Try again</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WriteDroneDialog shown when changes are ready */}
      {writeChanges && (
        <WriteDroneDialog
          changes={writeChanges}
          onClose={() => { setWriteChanges(null); setStage("error"); setErrorMsg("Flash cancelled."); }}
          onSuccess={handleWriteSuccess}
          onStart={(addLog) => {
            const current = new Map(
              (droneParams ?? []).map((p) => [p.name, parseFloat(p.value)])
            );
            // Pass the pre-computed diff so the engine doesn't re-diff and
            // strip SCR_USER1/SCR_USER2/SCR_ENABLE via RUNTIME_PARAMS filter.
            return flashParamsToDrone(flashTarget, current, addLog, writeChanges ?? undefined);
          }}
        />
      )}
    </>
  );
}
