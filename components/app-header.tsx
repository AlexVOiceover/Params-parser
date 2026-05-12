"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Library,
  Settings,
  Building2,
  Usb,
  User as UserIcon,
  LogOut,
  LogIn,
  ChevronDown,
  ClipboardList,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useAuth } from "@/components/auth-provider";
import { useSerialMode } from "@/lib/use-serial-mode";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { CURRENT_VERSION } from "@/lib/changelog";

const navLinkClass =
  "flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap";

export function AppHeader() {
  const { droneParams, openImportDialog } = useDroneParams();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const serialMode = useSerialMode();
  const hasWebSerial = serialMode !== "unsupported";
  const { user, role, clientName, signOut } = useAuth();

  const isAdmin = role === "admin";
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "found" | "latest">("idle");

  async function handleCheckUpdate() {
    if (!("serviceWorker" in navigator)) {
      setUpdateStatus("latest");
      return;
    }
    setCheckingUpdate(true);
    setUpdateStatus("idle");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { setUpdateStatus("latest"); setCheckingUpdate(false); return; }
      await reg.update();
      if (reg.waiting) {
        setUpdateStatus("found");
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        setTimeout(() => window.location.reload(), 500);
      } else {
        setUpdateStatus("latest");
      }
    } catch {
      setUpdateStatus("latest");
    }
    setCheckingUpdate(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/review-count")
      .then((r) => r.json())
      .then((d: { count: number }) => setReviewCount(d.count ?? 0))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const hasParams = droneParams !== null && droneParams.length > 0;

  return (
    <>
    <header className="flex items-center gap-2 sm:gap-3 border-b border-border bg-toolbar px-3 sm:px-4 py-2.5 shrink-0">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
      >
        <Library className="h-4 w-4 text-primary" />
        AIR6 Params
      </Link>
      <button
        onClick={() => setWhatsNewOpen(true)}
        title="What's new"
        className="hidden sm:inline-flex rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
      >
        v{CURRENT_VERSION}
      </button>
      <div className="flex-1" />

      {hasWebSerial && (
        <button
          onClick={openImportDialog}
          title="Import from drone"
          aria-label="Import from drone"
          className={`flex items-center gap-1.5 rounded-md border px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            hasParams
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
              : "border-border text-foreground hover:bg-secondary"
          }`}
        >
          <Usb className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{hasParams ? `Drone (${droneParams.length} params)` : "Import from drone"}</span>
          {hasParams && <span className="sm:hidden">{droneParams.length}</span>}
        </button>
      )}

      <div ref={userMenuRef} className="relative shrink-0">
        {user ? (
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 sm:px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            title={user.email ?? ""}
            aria-label={user.email ?? "Account"}
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline max-w-32 truncate">{user.email}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <Link href="/login" className={navLinkClass}>
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        )}

        {user && userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <div className="text-xs font-medium truncate">{user.email}</div>
              {role && (
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                  {role}
                  {role === "client" && clientName && (
                    <span className="normal-case"> · {clientName}</span>
                  )}
                </div>
              )}
            </div>
            {isAdmin && (
              <>
                <Link
                  href="/admin"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Users
                </Link>
                <Link
                  href="/admin/clients"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Clients & Drones
                </Link>
                <Link
                  href="/admin/review"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Review queue
                  {reviewCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                      {reviewCount}
                    </span>
                  )}
                </Link>
              </>
            )}
            <button
              onClick={() => { toggleTheme(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap border-t border-border"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            <button
              onClick={() => { setUserMenuOpen(false); handleCheckUpdate(); }}
              disabled={checkingUpdate}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap border-t border-border disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />
              {checkingUpdate ? "Checking…" : updateStatus === "found" ? "Update found — reloading" : updateStatus === "latest" ? "Already up to date" : "Check for updates"}
            </button>
            <button
              onClick={() => {
                setUserMenuOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap border-t border-border"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
    {whatsNewOpen && <WhatsNewDialog onClose={() => setWhatsNewOpen(false)} />}
    </>
  );
}
