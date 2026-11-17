"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  User as UserIcon,
  LogOut,
  LogIn,
  ChevronDown,
  RefreshCw,
  Sun,
  Moon,
  Map as MapIcon,
  Menu as MenuIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DroneChip } from "@/components/drone-chip";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { buttonClass } from "@/components/ui/styles";
import { CURRENT_VERSION } from "@/lib/changelog";

export function AppHeader() {
  const pathname = usePathname();
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const { user, role, clientName, signOut } = useAuth();

  const isAdmin = role === "admin";
  const isStaff = isAdmin || role === "contributor";
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

  const nav: { href: string; label: string; active: boolean; count?: number }[] = [
    { href: "/", label: isStaff ? "Drones" : "My drones", active: pathname === "/" || pathname.startsWith("/drones") },
    ...(isStaff ? [{ href: "/models", label: "Models", active: pathname.startsWith("/models") }] : []),
    { href: "/compare", label: "Compare", active: pathname.startsWith("/compare") },
    { href: "/filter", label: "Filter", active: pathname.startsWith("/filter") },
    ...(isAdmin ? [{ href: "/admin/review", label: "Review", active: pathname.startsWith("/admin/review"), count: reviewCount }] : []),
    ...(isAdmin ? [{ href: "/admin/clients", label: "Clients", active: pathname.startsWith("/admin/clients") }] : []),
  ];

  const updateLabel = checkingUpdate ? "Checking…" : updateStatus === "found" ? "Update found — reloading" : updateStatus === "latest" ? "Already up to date" : "Check for updates";

  return (
    <>
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-toolbar px-3 sm:gap-3 sm:px-5">
      {user && (
        <div className="md:hidden">
          <Menu
            label="Menu"
            trigger={<MenuIcon className="h-4 w-4" />}
            triggerClassName={buttonClass("ghost", "icon")}
          >
            {nav.map((n) => (
              <MenuItem key={n.href} href={n.href}>
                {n.label}{!!n.count && ` (${n.count})`}
              </MenuItem>
            ))}
          </Menu>
        </div>
      )}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
      >
        AIR6 Params
      </Link>
      <button
        onClick={() => setWhatsNewOpen(true)}
        title="What's new"
        className="hidden rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:border-input hover:text-foreground transition-colors cursor-pointer whitespace-nowrap sm:inline-flex"
      >
        v{CURRENT_VERSION}
      </button>
      {user && (
        <nav aria-label="Main" className="ml-3 hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? "page" : undefined}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                n.active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              {n.label}
              {!!n.count && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white">{n.count}</span>
              )}
            </Link>
          ))}
        </nav>
      )}
      <div className="flex-1" />

      {user && <DroneChip />}

      {user ? (
        <Menu
          align="end"
          label={user.email ?? "Account"}
          trigger={
            <>
              <UserIcon className="h-3.5 w-3.5" />
              <span className="hidden max-w-36 truncate lg:inline">{user.email}</span>
              <ChevronDown className="h-3 w-3" />
            </>
          }
          triggerClassName={buttonClass("secondary", "sm")}
        >
          <div className="px-2.5 py-2">
            <div className="truncate text-[13px] font-medium">{user.email}</div>
            {role && (
              <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {role}
                {role === "client" && clientName && (
                  <span className="normal-case"> · {clientName}</span>
                )}
              </div>
            )}
          </div>
          <MenuSeparator />
          {isAdmin && (
            <>
              <MenuItem href="/admin" icon={<Users className="h-3.5 w-3.5" />}>Users</MenuItem>
              <MenuItem href="/mission" icon={<MapIcon className="h-3.5 w-3.5" />}>Mission planner</MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem onSelect={toggleTheme} icon={isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}>
            {isDark ? "Light mode" : "Dark mode"}
          </MenuItem>
          <MenuItem onSelect={handleCheckUpdate} disabled={checkingUpdate} icon={<RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />}>
            {updateLabel}
          </MenuItem>
          <MenuItem onSelect={() => setWhatsNewOpen(true)}>What&apos;s new in v{CURRENT_VERSION}</MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={signOut} icon={<LogOut className="h-3.5 w-3.5" />}>Sign out</MenuItem>
        </Menu>
      ) : (
        <Link href="/login" className={buttonClass("secondary", "sm")}>
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Link>
      )}
    </header>
    {whatsNewOpen && <WhatsNewDialog onClose={() => setWhatsNewOpen(false)} />}
    </>
  );
}
