"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

/** OAuth / email-confirmation landing page. supabase-js exchanges the code in the URL on load. */
export default function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (loading || user) return;
    const timer = setTimeout(() => router.replace("/login"), 6000);
    return () => clearTimeout(timer);
  }, [loading, user, router]);

  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <Loader2 className="size-5 animate-spin" /> Signing you in…
      </div>
    </main>
  );
}
