"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Loader2, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/app/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs">
      <span className="bg-border h-px flex-1" />
      {children}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function useRedirectWhenSignedIn() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);
}

function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="h-10 w-full gap-2.5 text-sm"
      disabled={busy || !supabaseConfigured}
      onClick={async () => {
        setBusy(true);
        try {
          await signInWithGoogle();
        } catch (e) {
          toast.error(errorMessage(e));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  );
}

function SupabaseHint() {
  if (supabaseConfigured) return null;
  return (
    <p className="bg-warning/10 text-warning mt-3 rounded-lg px-3 py-2 text-xs">
      Supabase isn&apos;t configured yet, so Google and email sign-in are disabled. The demo account below works without
      it.
    </p>
  );
}

function DemoPanel() {
  const { signInDemo } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const config = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig, retry: false });
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      await signInDemo({ email: config.data?.demo_email ?? "demo@paperpal.dev", password: "paperpal-demo" });
      router.replace("/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  if (config.isError) {
    return (
      <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
        Can&apos;t reach the PaperPal API at {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}. Start the
        backend with <code className="font-mono">python run.py</code>.
      </p>
    );
  }
  if (config.data && !config.data.demo_enabled) return null;

  return (
    <div className={`border-primary/30 bg-primary/5 rounded-2xl border p-4 ${params.get("demo") ? "ring-primary/50 ring-2" : ""}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="text-primary size-4" /> Demo account
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        One click, no sign-up. Comes with a sample paper. Data resets whenever the API does.
      </p>
      <Button onClick={enter} disabled={busy || config.isPending} className="bg-gradient-brand mt-3 h-10 w-full border-0 text-white hover:opacity-90">
        {busy || config.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Enter as demo user
      </Button>
      {config.data?.demo_email && (
        <p className="text-muted-foreground mt-2.5 text-center text-[11px]">
          {config.data.demo_email} · password <code className="font-mono">paperpal-demo</code>
        </p>
      )}
    </div>
  );
}

export function LoginForm() {
  useRedirectWhenSignedIn();
  const { signInWithPassword, signInDemo } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("expired")) toast.info("Your session expired. Please sign in again.");
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Typing the demo credentials into the normal form works too.
      if (!supabaseConfigured || email.trim().toLowerCase() === "demo@paperpal.dev") {
        await signInDemo({ email, password });
      } else {
        await signInWithPassword(email, password);
      }
      router.replace("/dashboard");
    } catch (e2) {
      toast.error(errorMessage(e2));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to your research library.">
      <GoogleButton />
      <SupabaseHint />
      <Divider>or with email</Divider>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-10" />
        </div>
        <Button type="submit" disabled={busy} className="h-10 w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Sign in
        </Button>
      </form>
      <Divider>just exploring?</Divider>
      <DemoPanel />
      <p className="text-muted-foreground mt-6 text-center text-sm">
        New to PaperPal?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function SignupForm() {
  useRedirectWhenSignedIn();
  const { signUpWithPassword } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithPassword(email, password, name);
      if (needsConfirmation) setSentTo(email);
      else router.replace("/dashboard");
    } catch (e2) {
      toast.error(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" subtitle="One more step to activate your account.">
        <div className="text-center">
          <div className="bg-gradient-brand mx-auto mb-4 grid size-14 place-items-center rounded-2xl text-white">
            <MailCheck className="size-7" />
          </div>
          <p className="text-sm">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish signing up.
          </p>
          <Link href="/login" className="text-primary mt-6 inline-block text-sm font-medium hover:underline">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start turning papers into conversations.">
      <GoogleButton />
      <SupabaseHint />
      <Divider>or with email</Divider>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="h-10" />
        </div>
        <Button type="submit" disabled={busy || !supabaseConfigured} className="h-10 w-full">
          {busy && <Loader2 className="size-4 animate-spin" />} Create account
        </Button>
      </form>
      <Divider>or</Divider>
      <DemoPanel />
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
