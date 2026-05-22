"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Usb, X, Trash2, CheckCircle, AlertCircle, AlertTriangle, Loader2, ClipboardList } from "lucide-react";
import { openDroneConnection } from "@/lib/mavlink-serial";
import { getStoredDroneParamsCount, useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { useSerialMode } from "@/lib/use-serial-mode";
import { RegisterDroneModal, type RegisterMode } from "@/components/register-drone-modal";
import { useAuth } from "@/components/auth-provider";
import type { Param } from "@/lib/types";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
}

const BAUD_RATE = 115200;

type Stage = "idle" | "running" | "done" | "error";

interface Props {
  onParamsLoaded: (params: Param[]) => void;
  onClose: () => void;
  /** Called when user clicks "Forget" to clear stored drone params. */
  onForget?: () => void;
}

export function ConnectDroneDialog({ onParamsLoaded, onClose, onForget }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [storedCount, setStoredCount] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const serialMode = useSerialMode();
  const match = useConnectedDroneMatch();
  const { droneParams } = useDroneParams();
  const { role } = useAuth();
  const [registerMode, setRegisterMode] = useState<RegisterMode | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<string | null>(null);

  useEffect(() => {
    setStoredCount(getStoredDroneParamsCount());
    setMobile(isMobile());
    setIosDevice(isIOS());
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleCapture() {
    if (!droneParams || !match.drone?.client_set_id || match.droneVersion === null) return;
    setCapturing(true);
    setCaptureResult(null);
    const res = await fetch("/api/admin/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSetId: match.drone.client_set_id,
        versionLabel: String(match.droneVersion),
        params: droneParams,
      }),
    });
    setCapturing(false);
    if (res.ok) {
      setCaptureResult(`Saved as v${match.droneVersion} — marked for review`);
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setCaptureResult(`Capture failed: ${body.error ?? "unknown error"}`);
    }
  }

  const connect = useCallback(async () => {
    setStage("running");
    setLog([]);
    setError("");
    setReceived(0);
    setTotal(0);

    const disconnect = await openDroneConnection(BAUD_RATE, {
      onLog: addLog,
      onProgress(recv, tot) {
        setReceived(recv);
        if (tot > 0) setTotal(tot);
      },
      onDone(params) {
        disconnectRef.current = null;
        setStage("done");
        setReceived(params.length);
        onParamsLoaded(params.map((p) => ({ name: p.name, value: p.value })));
      },
      onError(msg) {
        disconnectRef.current = null;
        setError(msg);
        setStage("error");
        addLog(`✗ ${msg}`);
      },
    });

    disconnectRef.current = disconnect;
  }, [onParamsLoaded]);

  function handleClose() {
    disconnectRef.current?.();
    onClose();
  }

  function handleForget() {
    onForget?.();
    setStoredCount(0);
  }

  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  const busy = stage === "running";

  return (
    <>
    {registerMode && (
      <RegisterDroneModal
        mode={registerMode}
        onClose={() => setRegisterMode(null)}
        onSuccess={() => { setRegisterMode(null); handleClose(); }}
      />
    )}
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!busy ? handleClose : undefined}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Usb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Connect to drone</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {stage === "idle" && iosDevice && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              <p className="font-semibold mb-1">Not supported on iOS</p>
              <p>iOS doesn&apos;t support WebUSB or Web Serial. Please use Chrome on Android, Windows, macOS, or Linux to connect a drone.</p>
            </div>
          )}

          {stage === "idle" && !iosDevice && serialMode === "unsupported" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <p className="font-semibold mb-1">Browser not supported</p>
              <p>Use a Chromium-based browser (Chrome, Edge) to connect a drone via USB.</p>
            </div>
          )}

          {stage === "idle" && !iosDevice && serialMode !== "unsupported" && (
            <div className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-2">
              {mobile ? (
                <>
                  <p>
                    Connect your flight controller using a <span className="font-semibold text-foreground">USB-OTG cable</span>.
                    A regular C-to-C cable will not work — you need an OTG adapter that puts the phone in host mode.
                  </p>
                  <p>Tap your drone in the device picker. Keep the screen on while reading.</p>
                </>
              ) : (
                <>
                  <p>Connect your flight controller via USB. Chrome will show a COM port picker.</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    Some boards expose multiple ports (e.g. Cube Orange shows SLCAN + MAVLink). If you get no data, retry and pick the other port — the MAVLink port is usually the one with the higher COM number.
                  </p>
                </>
              )}
              {serialMode === "polyfill" && (
                <p className="text-[10px] text-muted-foreground/70 italic">
                  Using WebUSB polyfill (Android Chrome compatibility mode)
                </p>
              )}
            </div>
          )}

          {/* Progress bar */}
          {stage === "running" && total > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {received} / {total} params ({pct}%)
              </p>
            </div>
          )}

          {/* Done summary */}
          {stage === "done" && (
            <>
              <p className="text-xs text-emerald-400">✓ {received} parameters loaded.</p>
              {match.status !== "idle" && (
                <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 flex flex-col gap-1">
                  {match.status === "loading" && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Looking up drone…
                    </p>
                  )}
                  {match.status === "matched" && match.drone && (
                    <>
                      <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        Drone identified
                      </p>
                      <div className="flex flex-col gap-0.5 text-xs">
                        {(() => {
                          const scrUser1Param = droneParams?.find((p) => p.name === "SCR_USER1");
                          const scrUser1 = scrUser1Param ? parseInt(scrUser1Param.value, 10) : null;
                          const rows: [string, React.ReactNode][] = [
                            ["Catalog serial", <span className="font-mono">{match.drone.serial}</span>],
                          ];
                          if (scrUser1 !== null && Number.isFinite(scrUser1) && scrUser1 > 0) {
                            rows.push(["Drone reports", <span className="font-mono">{scrUser1}</span>]);
                          }
                          rows.push(["Client", match.isOrphan ? <span className="italic text-muted-foreground">No client</span> : (match.drone.client_name ?? "—")]);
                          if (match.drone.family_name) rows.push(["Family", match.drone.family_name]);
                          if (match.drone.variant_name) rows.push(["Variant", match.drone.variant_name]);
                          return rows.map(([label, value]) => (
                            <div key={label} className="flex items-baseline gap-1.5">
                              <span className="text-muted-foreground shrink-0">{label}:</span>
                              <span className="text-foreground">{value}</span>
                            </div>
                          ));
                        })()}
                      </div>
                      {match.versionStatus === "up_to_date" && match.droneVersion !== null && (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle className="h-3 w-3 shrink-0" />
                          Version {match.droneVersion} — up to date
                        </p>
                      )}
                      {match.versionStatus === "up_to_date_modified" && match.droneVersion !== null && match.drone?.latest_version_id && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          v{match.droneVersion} — {match.driftCount} param{match.driftCount === 1 ? "" : "s"} differ from catalog{" "}
                          <a href={`/compare?v=__drone__&v=${match.drone.latest_version_id}`} className="underline cursor-pointer ml-1">Review</a>
                        </p>
                      )}
                      {match.versionStatus === "update_available" && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Update available — catalog is v{match.catalogVersion}, drone has v{match.droneVersion}
                        </p>
                      )}
                      {match.versionStatus === "drone_ahead" && (
                        <>
                          <p className="flex items-center gap-1.5 text-xs text-sky-400 bg-sky-400/10 border border-sky-400/30 rounded px-2 py-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Drone has v{match.droneVersion}, catalog latest is v{match.catalogVersion}
                          </p>
                          {(role === "admin" || role === "contributor") && match.drone?.client_set_id && droneParams && (
                            captureResult ? (
                              <p className={`text-xs px-2 py-1 rounded border ${captureResult.startsWith("Capture failed") ? "text-destructive border-destructive/40 bg-destructive/10" : "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"}`}>
                                {captureResult}
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={handleCapture}
                                disabled={capturing}
                                className="flex items-center gap-1.5 text-xs text-sky-300 bg-sky-400/10 border border-sky-400/30 hover:bg-sky-400/20 rounded px-2 py-1 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
                              >
                                {capturing ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
                                {capturing ? "Capturing…" : "Capture to catalog"}
                              </button>
                            )
                          )}
                        </>
                      )}
                    </>
                  )}
                  {match.status === "unmatched" && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Not registered in the catalog
                    </p>
                  )}
                </div>
              )}
              {/* Register prompt: unmatched, unversioned, or SCR_ENABLE=0 (fresh drone) */}
              {(() => {
                const scrEnable = droneParams?.find((p) => p.name === "SCR_ENABLE");
                const isFreshDrone = scrEnable ? parseInt(scrEnable.value, 10) === 0 : false;
                const ms = match.status as string;
                const shouldShowRegister =
                  isFreshDrone ||
                  ms === "unmatched" ||
                  (match.droneVersion === null && (ms === "matched" || ms === "unmatched"));
                if (!shouldShowRegister) return null;
                return (
                  <div className="flex flex-col gap-2 mt-1">
                    {/* Primary: safe, preserves params */}
                    <button
                      type="button"
                      onClick={() => setRegisterMode("capture")}
                      className="flex flex-col items-start gap-0.5 rounded-md bg-primary hover:bg-primary/90 px-3 py-2.5 text-primary-foreground transition-colors cursor-pointer w-full text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                        Register &amp; keep current params
                      </div>
                      <div className="text-[10px] opacity-80 pl-5">
                        Captures the drone&apos;s params as v1. Only writes SCR identifiers.
                      </div>
                    </button>
                    {/* Secondary: destructive, factory-fresh only */}
                    <button
                      type="button"
                      onClick={() => setRegisterMode("flash")}
                      className="flex flex-col items-start gap-0.5 rounded-md border border-amber-500/30 hover:bg-amber-500/5 px-3 py-2 text-foreground transition-colors cursor-pointer w-full text-left"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                        Register &amp; flash defaults
                      </div>
                      <div className="text-[10px] text-muted-foreground pl-5">
                        Overwrites all params with catalog Default. Factory-fresh drones only.
                      </div>
                    </button>
                  </div>
                );
              })()}
            </>
          )}

          {/* Log */}
          {log.length > 0 && (
            <div className="rounded-md border border-border bg-black/30 px-3 py-2 max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {log.map((line, i) => (
                <p key={i} className={`font-mono text-[11px] leading-relaxed ${line.startsWith("✗") || line.startsWith("⚠") ? "text-amber-400" : "text-muted-foreground"}`}>
                  <span className="text-muted-foreground/40 mr-1.5">›</span>{line}
                </p>
              ))}
              {busy && (
                <p className="font-mono text-[11px] text-muted-foreground/40 animate-pulse">
                  <span className="mr-1.5">›</span>…
                </p>
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border bg-toolbar px-5 py-3">
          {onForget && storedCount > 0 && (stage === "idle" || stage === "error") && (
            <button
              onClick={handleForget}
              title={`Forget ${storedCount} stored param${storedCount === 1 ? "" : "s"}`}
              className="flex items-center gap-1.5 rounded-md border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Forget ({storedCount})
            </button>
          )}
          <div className="flex-1" />
          {!busy && stage !== "done" && (
            <button
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          )}
          {(stage === "idle" || stage === "error") && (
            <button
              onClick={connect}
              disabled={iosDevice || serialMode === "unsupported"}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              {stage === "error" ? "Retry" : "Connect"}
            </button>
          )}
          {busy && (
            <button
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          )}
          {stage === "done" && (
            <button
              onClick={handleClose}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
