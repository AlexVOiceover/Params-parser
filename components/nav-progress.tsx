"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * App-wide navigation feedback.
 *
 * Every data page is `force-dynamic`, so a click can sit for a second or more
 * with the old page still on screen and nothing acknowledging the press. This
 * listens for link clicks in the capture phase and shows a progress bar
 * immediately, then hides it when the new route commits.
 *
 * It hooks navigation globally so individual links need no changes.
 */

const CLICK_GRACE_MS = 120; // don't flash the bar for instant, cached routes
const DONE_FADE_MS = 220;

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (tick.current) clearInterval(tick.current);
    showTimer.current = null;
    hideTimer.current = null;
    tick.current = null;
  }

  // Start on any same-origin navigation the user initiates.
  useEffect(() => {
    function start() {
      clearTimers();
      showTimer.current = setTimeout(() => {
        setVisible(true);
        setProgress(8);
        // Ease toward 90% — the remaining 10% lands when the route commits, so
        // the bar never implies completion it can't guarantee.
        tick.current = setInterval(() => {
          setProgress((p) => (p >= 90 ? p : p + Math.max(0.6, (90 - p) * 0.09)));
        }, 90);
      }, CLICK_GRACE_MS);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same URL — nothing will commit, so nothing to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    }

    // Back/forward also re-render a dynamic page.
    function onPopState() { start(); }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  // The route committed — finish and fade out.
  useEffect(() => {
    clearTimers();
    setProgress((p) => (p > 0 ? 100 : 0));
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, DONE_FADE_MS);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${DONE_FADE_MS}ms ease` }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: "width 180ms ease-out",
          boxShadow: "0 0 8px var(--primary)",
        }}
      />
    </div>
  );
}

/**
 * Screen-reader announcement for the same navigations the bar covers.
 * Kept separate so the visual bar can stay aria-hidden.
 */
export function NavProgressAnnouncer({ busy }: { busy: boolean }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {busy ? "Loading page" : ""}
    </div>
  );
}
