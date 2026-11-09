/**
 * Framework-agnostic session storage shared by the API client and the React auth provider.
 * Two session kinds exist: a Supabase session (managed by supabase-js) and the local demo
 * session, whose backend-issued token lives in localStorage.
 */
import { getSupabase } from "@/lib/supabase";

const DEMO_KEY = "paperpal.demo-session";

export interface DemoSession {
  token: string;
  expiresAt: number;
}

export function readDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as DemoSession;
    if (session.expiresAt <= Date.now()) {
      localStorage.removeItem(DEMO_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function writeDemoSession(token: string, expiresAtIso: string): void {
  try {
    // The backend sends a naive UTC timestamp; make sure it is parsed as UTC.
    const iso = /Z|[+-]\d\d:?\d\d$/.test(expiresAtIso) ? expiresAtIso : `${expiresAtIso}Z`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ token, expiresAt: Date.parse(iso) } satisfies DemoSession));
  } catch {
    /* storage unavailable (private mode); the session lasts until reload */
  }
}

export function clearDemoSession(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}

export async function getAccessToken(): Promise<string | null> {
  const demo = readDemoSession();
  if (demo) return demo.token;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type UnauthorizedListener = () => void;
const listeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called by the API client when the backend rejects the current token. */
export function handleUnauthorized(): void {
  clearDemoSession();
  listeners.forEach((listener) => listener());
}
