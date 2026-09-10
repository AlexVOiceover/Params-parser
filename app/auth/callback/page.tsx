"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Completes sign-in for links that return the session in a URL hash
 * (`#access_token=...&refresh_token=...`).
 *
 * Supabase's /auth/v1/verify redirects here with the tokens in the fragment,
 * which browsers never send to the server — so this has to run client-side.
 * PKCE links (`?code=`) are handled by route.ts instead and never reach here.
 */
export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    const search = new URLSearchParams(window.location.search);
    const next = search.get("next") ?? "/";

    const supabase = createClient();
    if (!supabase) {
      setFailed(true);
      window.location.replace("/login?error=auth_failed");
      return;
    }

    // PKCE links arrive as ?code= instead of a hash fragment.
    const code = search.get("code");
    if (!access_token || !refresh_token) {
      if (code) {
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ error }) => {
            if (error) {
              setFailed(true);
              window.location.replace("/login?error=auth_failed");
              return;
            }
            window.location.replace(next);
          })
          .catch(() => {
            setFailed(true);
            window.location.replace("/login?error=auth_failed");
          });
        return;
      }
      setFailed(true);
      window.location.replace("/login?error=auth_failed");
      return;
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          window.location.replace("/login?error=auth_failed");
          return;
        }
        // Hard navigate so the server sees the freshly written auth cookie.
        window.location.replace(next);
      })
      .catch(() => {
        setFailed(true);
        window.location.replace("/login?error=auth_failed");
      });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm text-muted-foreground">
        {failed ? "Signing you in failed." : "Signing you in…"}
      </p>
    </div>
  );
}
