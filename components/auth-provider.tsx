"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  role: string | null;
  clientName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  clientName: null,
  loading: true,
  signOut: async () => {},
});

async function fetchMeFromServer(): Promise<{ role: string | null; clientName: string | null }> {
  try {
    const res = await fetch("/api/me");
    const body = await res.json();
    return { role: body.role ?? null, clientName: body.clientName ?? null };
  } catch {
    return { role: null, clientName: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabaseRef.current = supabase;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const me = await fetchMeFromServer();
        setRole(me.role);
        setClientName(me.clientName);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const me = await fetchMeFromServer();
        setRole(me.role);
        setClientName(me.clientName);
      } else {
        setRole(null);
        setClientName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabaseRef.current?.auth.signOut();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, role, clientName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
