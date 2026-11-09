"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { clearDemoSession, onUnauthorized, readDemoSession, writeDemoSession } from "@/lib/auth-store";
import { getSupabase } from "@/lib/supabase";
import type { AppUser } from "@/lib/types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signInDemo: (credentials?: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromSession(session: Session | null): AppUser | null {
  if (!session) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    isDemo: false,
  };
}

const DEMO_USER: AppUser = { id: "demo-user", email: "demo@paperpal.dev", name: "Demo Researcher", isDemo: true };

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    async function init() {
      if (readDemoSession()) {
        if (active) setUser(DEMO_USER);
      } else if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (active) setUser(userFromSession(data.session));
      }
      if (active) setLoading(false);
    }
    void init();

    const { data: subscription } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!readDemoSession()) setUser(userFromSession(session));
        })
      : { data: null };
    const stopUnauthorized = onUnauthorized(() => {
      setUser(null);
      void supabase?.auth.signOut();
      router.replace("/login?expired=1");
    });
    return () => {
      active = false;
      subscription?.subscription.unsubscribe();
      stopUnauthorized();
    };
  }, [router]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    clearDemoSession();
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    setUser(userFromSession(data.session));
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, name: string) => {
    clearDemoSession();
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (data.session) setUser(userFromSession(data.session));
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    clearDemoSession();
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signInDemo = useCallback(async (credentials?: { email: string; password: string }) => {
    const session = await api.demoLogin(credentials);
    writeDemoSession(session.access_token, session.expires_at);
    setUser(DEMO_USER);
  }, []);

  const signOut = useCallback(async () => {
    clearDemoSession();
    await getSupabase()?.auth.signOut();
    setUser(null);
    router.replace("/");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, signInWithPassword, signUpWithPassword, signInWithGoogle, signInDemo, signOut }),
    [user, loading, signInWithPassword, signUpWithPassword, signInWithGoogle, signInDemo, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
