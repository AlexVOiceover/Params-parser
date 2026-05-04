"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { devSignIn } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError =
    searchParams.get("error") === "auth_failed"
      ? "Authentication failed. Please request a new link."
      : null;

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setError(urlError);
  }, [urlError]);

  // If already signed in, bounce to `next` instead of showing the form.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(next);
      }
    });
  }, [router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Dev shortcut: sign in directly without the email round-trip.
      const dev = await devSignIn(email);
      if (dev.ok) {
        // Hard navigate so AuthProvider re-reads the cookie. router.push leaves
        // the in-memory auth state stale because onAuthStateChange doesn't fire
        // for server-action sign-ins.
        window.location.href = next;
        return;
      }
      if (!("skipped" in dev)) {
        setError(dev.error);
        setLoading(false);
        return;
      }

      // Production: send a real magic-link email.
      const supabase = createClient();
      if (!supabase) {
        setError("Auth not configured.");
        setLoading(false);
        return;
      }

      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: false },
      });

      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-toolbar px-5 py-4">
        <LogIn className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-bold text-foreground">AIR6 · Sign In</h1>
      </div>

      {sent ? (
        <div className="p-5 flex flex-col gap-3 items-center text-center">
          <CheckCircle className="h-10 w-10 text-emerald-400" />
          <p className="text-sm font-medium text-foreground">Check your email</p>
          <p className="text-xs text-muted-foreground">
            We sent a magic link to <span className="font-medium text-foreground">{email}</span>. Click it to sign in — you can close this tab.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Mail className="h-4 w-4" />
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      <div className="border-t border-border bg-toolbar px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Accounts are created by administrators. No self-registration.
        </p>
      </div>
    </div>
  );
}
