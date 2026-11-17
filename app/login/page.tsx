"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, CheckCircle } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { buttonClass, cardClass, fieldClass, labelClass } from "@/components/ui/styles";
import { createClient } from "@/lib/supabase/client";
import { devSignIn } from "./actions";

/**
 * Supabase surfaces raw throttling errors that mean nothing to a user — most
 * notably "you can only request this after 0 seconds", where the remaining
 * wait is rounded down to zero. Translate the ones people actually hit.
 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("only request this after")) {
    const secs = parseInt(/after (\d+) second/.exec(m)?.[1] ?? "0", 10);
    return secs > 5
      ? `Please wait ${secs} seconds before requesting another link.`
      : "Please wait a few seconds before requesting another link.";
  }
  if (m.includes("rate limit")) {
    return "Too many sign-in emails have been sent. Please wait a few minutes and try again.";
  }
  if (m.includes("signups not allowed") || m.includes("user not found")) {
    return "No account found for that email. Ask an administrator to invite you.";
  }
  return message;
}

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
  const rawNext = searchParams.get("next") ?? "/";
  // Only same-site paths: "//host" or "https://…" would be an open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/";
  const errParam = searchParams.get("error");
  const urlError =
    errParam === "link_used"
      ? "That sign-in link has expired or was already used. Request a new one below and open it in your browser."
      : errParam === "auth_failed"
      ? "Authentication failed. Please request a new link."
      : null;

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Six-digit code step. Link scanners (Outlook/Hotmail Safe Links) pre-fetch
  // URLs and burn the single-use token, so the code is the reliable path.
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

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
        setError(friendlyAuthError(otpError.message));
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the code from the email.");
      return;
    }
    setVerifying(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Auth not configured.");
      setVerifying(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (verifyErr) {
      setError(friendlyAuthError(verifyErr.message));
      setVerifying(false);
      return;
    }

    // Hard navigate so the server sees the freshly written auth cookie.
    window.location.href = next;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="text-center">
        <p className="text-xl font-semibold tracking-tight text-foreground">AIR6 Params</p>
        <p className="mt-1 text-sm text-muted-foreground">Every drone on the right params.</p>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <LogIn className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Sign in</h1>
        </div>

        {sent ? (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium text-foreground">Check your email</p>
              <p className="text-[13px] text-muted-foreground">
                We sent a sign-in code to <span className="font-medium text-foreground">{email}</span>.
                Enter it below — or click the link in the same email.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="otp-code">Code</label>
              <input
                id="otp-code"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(null); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="12345678"
                className="h-11 rounded-lg border border-input bg-field px-3 text-center font-mono text-lg tracking-[0.3em] text-foreground placeholder:text-muted-foreground placeholder:tracking-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {error}
              </p>
            )}

            <BusyButton
              type="submit"
              variant="primary"
              size="md"
              busy={verifying}
              busyLabel="Verifying…"
              disabled={code.replace(/\D/g, "").length < 6}
            >
              Sign in
            </BusyButton>

            <button
              type="button"
              onClick={() => { setSent(false); setCode(""); setError(null); }}
              className={buttonClass("ghost")}
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={`${fieldClass} w-full`}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {error}
              </p>
            )}

            <BusyButton
              type="submit"
              variant="primary"
              size="md"
              busy={loading}
              busyLabel="Sending…"
              icon={<Mail className="h-4 w-4" />}
            >
              Send magic link
            </BusyButton>
          </form>
        )}

        <div className="border-t border-border bg-secondary/40 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Accounts are created by administrators. No self-registration.
          </p>
        </div>
      </div>
    </div>
  );
}
