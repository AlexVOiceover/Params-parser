"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Usb, X, Trash2, AlertTriangle, ClipboardList } from "lucide-react";
import { openDroneConnection, type AutopilotInfo } from "@/lib/mavlink-serial";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { DroneStatusPanel } from "@/components/drone-status-panel";
import { useSerialMode } from "@/lib/use-serial-mode";
import { getGrantedDronePorts, dronePortName } from "@/lib/serial-shim";
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
  onParamsLoaded: (params: Param[], info: AutopilotInfo | null) => void;
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
  const autopilotRef = useRef<AutopilotInfo | null>(null);
  const [mobile, setMobile] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const serialMode = useSerialMode();
  const match = useConnectedDroneMatch();
  const { droneParams } = useDroneParams();
  const storedCount = droneParams?.length ?? 0;
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "contributor";
  const [registerMode, setRegisterMode] = useState<RegisterMode | null>(null);
  const [registerChoice, setRegisterChoice] = useState(false);
  /** Board behind a port granted before; null when none, so the picker will show. */
  const [knownBoard, setKnownBoard] = useState<string | null>(null);

  useEffect(() => {
    if (serialMode === "unsupported") return;
    let live = true;
    getGrantedDronePorts()
      .then((ports) => {
        if (!live || ports.length === 0) return;
        setKnownBoard(ports.map(dronePortName).find((n) => n !== null) ?? "flight controller");
      })
      .catch(() => {});
    return () => { live = false; };
  }, [serialMode]);

  useEffect(() => {
    setMobile(isMobile());
    setIosDevice(isIOS());
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  const connect = useCallback(async (choosePort: boolean) => {
    setStage("running");
    setLog([]);
    setError("");
    setReceived(0);
    setTotal(0);
    autopilotRef.current = null;

    const disconnect = await openDroneConnection(BAUD_RATE, {
      onLog: addLog,
      onAutopilotInfo(info) { autopilotRef.current = info; },
      onProgress(recv, tot) {
        setReceived(recv);
        if (tot > 0) setTotal(tot);
      },
      onDone(params) {
        disconnectRef.current = null;
        setStage("done");
        setReceived(params.length);
        onParamsLoaded(params.map((p) => ({ name: p.name, value: p.value })), autopilotRef.current);
      },
      onError(msg) {
        disconnectRef.current = null;
        setError(msg);
        setStage("error");
        addLog(`✗ ${msg}`);
      },
    }, { choosePort });

    disconnectRef.current = disconnect;
  }, [onParamsLoaded]);

  function handleClose() {
    disconnectRef.current?.();
    onClose();
  }

  function handleForget() {
    onForget?.();
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
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
        onClick={!busy ? handleClose : undefined}
      />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

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
                  <p>
                    {knownBoard ? `The app reconnects to the ${knownBoard} used before.` : "Tap your drone in the device picker."}{" "}
                    Keep the screen on while reading.
                  </p>
                </>
              ) : (
                <>
                  {knownBoard ? (
                    <p>
                      Plug in the {knownBoard} via USB. The app finds the port it used before, so Chrome&apos;s port picker
                      won&apos;t show.
                    </p>
                  ) : (
                    <>
                      <p>Connect your flight controller via USB. Chrome will show a COM port picker the first time.</p>
                      <p className="text-[11px] text-muted-foreground/70">
                        Some boards expose two ports (a Cube shows SLCAN + MAVLink). If you get no data, retry and pick the
                        other port. The MAVLink port is usually the one with the higher COM number.
                      </p>
                    </>
                  )}
                </>
              )}
              {serialMode === "polyfill" && (
                <p className="text-[11px] text-muted-foreground/70 italic">
                  Using WebUSB polyfill (Android Chrome compatibility mode)
                </p>
              )}
            </div>
          )}

          {(stage === "idle" || stage === "error") && knownBoard && serialMode !== "unsupported" && !iosDevice && (
            <button
              type="button"
              onClick={() => connect(true)}
              className="self-start text-xs text-primary hover:underline cursor-pointer whitespace-nowrap"
            >
              Use a different port…
            </button>
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
              <p className="text-[11px] text-muted-foreground text-right">
                {received} / {total} params ({pct}%)
              </p>
            </div>
          )}

          {/* Done summary */}
          {stage === "done" && (
            <>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ {received} parameters loaded.</p>
              <DroneStatusPanel
                match={match}
                onRegister={isStaff ? () => setRegisterChoice(true) : undefined}
                onNavigate={handleClose}
              />
              {registerChoice && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterMode("capture")}
                    className="flex flex-col items-start gap-0.5 rounded-md bg-primary hover:bg-primary/90 px-3 py-2.5 text-primary-foreground transition-colors cursor-pointer w-full text-left"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      Register &amp; keep current params
                    </div>
                    <div className="text-[11px] opacity-80 pl-5">
                      Links this flight controller and saves its params as v1. Writes nothing.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterMode("flash")}
                    className="flex flex-col items-start gap-0.5 rounded-md border border-amber-500/30 hover:bg-amber-500/5 px-3 py-2 text-foreground transition-colors cursor-pointer w-full text-left"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                      Register &amp; install the model template
                    </div>
                    <div className="text-[11px] text-muted-foreground pl-5">
                      Installs its model&apos;s template (keeping this drone&apos;s calibration and tuning), verifies it and saves the result as v1.
                    </div>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Log */}
          {log.length > 0 && (
            <div className="rounded-md border border-border bg-black/30 px-3 py-2 max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {log.map((line, i) => (
                <p key={i} className={`font-mono text-[11px] leading-relaxed ${line.startsWith("✗") || line.startsWith("⚠") ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
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
              className="flex items-center gap-1.5 rounded-md border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
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
              onClick={() => connect(false)}
              disabled={iosDevice || serialMode === "unsupported"}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              {stage === "error" ? "Retry" : knownBoard ? `Connect to ${knownBoard}` : "Connect"}
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
