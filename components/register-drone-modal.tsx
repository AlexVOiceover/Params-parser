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

interface FamilyRow { id: string; name: string; }
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

interface Props {
  onClose: () => void;
}

const inputClass = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";
const selectClass = inputClass + " cursor-pointer";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted-foreground";

export function RegisterDroneModal({ onClose }: Props) {
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
  const [serial, setSerial] = useState(scrUser1IsSet ? String(scrUser1Val) : "");
  const [familyId, setFamilyId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [clientId, setClientId] = useState("__orphan__");

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
      supabase.from("families").select("id, name").order("name"),
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
        // Pre-fill and lock family/variant from DB
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

  function handleFamilyChange(fid: string) {
    setFamilyId(fid);
    setVariantId("");
  }

  async function handleConfirm() {
    if (!serial.trim() || !variantId) return;
    setStage("confirm");
  }

  async function handleFlash() {
    setStage("flashing");
    setErrorMsg("");

    const supabase = createClient()!;

    // 1. Create drone row (or reuse existing)
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

    // 2. Create client_set if client selected
    if (clientId !== "__orphan__" && droneId) {
      const csRes = await fetch("/api/admin/client-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          clientId,
          droneId,
          clientName: clients.find((c) => c.id === clientId)?.name ?? "",
          serial: serial.trim(),
        }),
      });
      if (!csRes.ok) {
        const b = await csRes.json();
        // 409 = already exists, that's fine
        if (csRes.status !== 409) {
          setErrorMsg(b?.error ?? "Failed to create param set"); setStage("error"); return;
        }
      }
    }

    // 3. Fetch Default param_values for the variant
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

    // 4. Build diff (Default params vs current drone params)
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

    // Override SCR_USER1 with the drone's correct serial trailing-int
    const serialInt = parseSerialId(serial.trim());
    if (serialInt !== null) target.set("SCR_USER1", serialInt);

    // Always write SCR_USER2 with the version being flashed
    const versionInt = parseInt(latestPV.version_label, 10);
    if (Number.isFinite(versionInt)) target.set("SCR_USER2", versionInt);

    setFlashedVersion(latestPV.version_label);
    setFlashTarget(new Map(target));

    const droneMap = new Map((droneParams ?? []).map((p) => [p.name, parseFloat(p.value)]));
    const diff: WriteChange[] = [];
    for (const [name, targetVal] of target.entries()) {
      if (RUNTIME_PARAMS.has(name)) continue;
      const droneVal = droneMap.get(name);
      if (droneVal === undefined || droneVal !== targetVal) {
        diff.push({ name, value: targetVal });
      }
    }

    if (diff.length === 0) {
      // Nothing to write — drone already has the right params
      handleWriteSuccess([]);
      return;
    }

    setWriteChanges(diff);
  }

  function handleWriteSuccess(written: ParamWriteResult[]) {
    if (droneParams && written.length > 0) {
      const writtenMap = new Map(written.map((r) => [r.name, r.actual ?? r.requested]));
      const updated = droneParams.map((p) => {
        const v = writtenMap.get(p.name);
        return v !== undefined ? { ...p, value: String(v) } : p;
      });
      setDroneParams(updated);
    }
    setWriteChanges(null);
    clearDroneMatchCache();
    setStage("done");
    startTransition(() => router.refresh());
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
              <h2 className="text-sm font-bold text-foreground">Register drone</h2>
              {stage !== "form" && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  <span className="capitalize">{stage === "flashing" ? "Flashing…" : stage}</span>
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

                {/* Serial */}
                <label className={labelClass}>
                  <span className={labelTextClass}>Serial <span className="text-destructive">*</span></span>
                  {scrUser1IsSet ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground bg-secondary border border-border rounded-md px-3 py-2 flex-1">
                        {serial}
                      </span>
                      <span className="text-[10px] text-muted-foreground">from SCR_USER1</span>
                    </div>
                  ) : (
                    <input
                      required
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      onBlur={(e) => e.target.value && checkSerialInDB(e.target.value)}
                      placeholder="e.g. AIR4-0426-0023"
                      className={inputClass}
                    />
                  )}
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
                <p className="text-sm text-muted-foreground">Review before registering and flashing:</p>
                <dl className="rounded-lg border border-border bg-secondary/30 divide-y divide-border text-sm">
                  {[
                    ["Serial", serial],
                    ["Family / Variant", `${selectedFamily?.name ?? existingDrone?.familyName ?? "?"} / ${selectedVariant?.name ?? existingDrone?.variantName ?? "?"}`],
                    ["Client", isOrphan ? "No client (orphan)" : (selectedClient?.name ?? "?")],
                    ["Action", existingDrone ? "Re-flash Default to drone" : "Register drone + flash Default"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between px-3 py-2 gap-3">
                      <dt className="text-muted-foreground shrink-0">{label}</dt>
                      <dd className={`text-right font-medium ${isOrphan && label === "Client" ? "text-muted-foreground italic font-normal" : "text-foreground"}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed">
                    The Default param set will be flashed to the drone. Make sure the drone is safe (disarmed, no props).
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setStage("form")} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap">Back</button>
                  <button
                    onClick={handleFlash}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Register & Flash
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
                  <span className="font-mono">{serial}</span> is now registered and flashed with the Default param set (v{flashedVersion}).
                </p>
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <WriteNFCButton
                    serial={serial}
                    label="Write NFC tag"
                    className="w-full justify-center"
                  />
                  <p className="text-[10px] text-muted-foreground">Write the serial to the NFC sticker on the drone</p>
                </div>
                <button onClick={onClose} className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap">Done</button>
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
            return flashParamsToDrone(flashTarget, current, addLog);
          }}
        />
      )}
    </>
  );
}
