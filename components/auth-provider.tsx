"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  role: string | null;
  clientName: string | null;
  /** The profile's display name; defaults to the part of the e-mail before the @. */
  username: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Show a new display name straight away after it was saved. */
  setUsername: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  clientName: null,
  username: null,
  loading: true,
  signOut: async () => {},
  setUsername: () => {},
});

interface Me { role: string | null; clientName: string | null; username: string | null }

async function fetchMeFromServer(): Promise<Me> {
  try {
    const res = await fetch("/api/me");
    const body = (await res.json()) as Partial<Me>;
    return { role: body.role ?? null, clientName: body.clientName ?? null, username: body.username ?? null };
  } catch {
    return { role: null, clientName: null, username: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
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
        setUsername(me.username);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const me = await fetchMeFromServer();
        setRole(me.role);
        setClientName(me.clientName);
        setUsername(me.username);
      } else {
        setRole(null);
        setClientName(null);
        setUsername(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabaseRef.current?.auth.signOut();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, role, clientName, username, loading, signOut, setUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
