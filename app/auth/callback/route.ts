import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  // Invite / recovery / email-change links arrive as a token_hash + type pair
  // rather than a PKCE code, so both shapes have to be handled here.
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/";

  const supabase = await createSessionClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
}
