"use client";

import { ChevronsUpDown, FlaskConical, LayoutGrid, Loader2, LogOut } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { usePapers } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string | null) {
  return (name ?? email ?? "?").split(/[\s@.]/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-accent flex items-center gap-3 rounded-xl p-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !compact && "w-full",
        )}
      >
        <Avatar className="size-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-gradient-brand text-xs font-semibold text-white">{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name ?? user.email}</div>
              <div className="text-muted-foreground truncate text-xs">{user.isDemo ? "Demo account" : user.email}</div>
            </div>
            <ChevronsUpDown className="text-muted-foreground size-4" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          {user.isDemo && <FlaskConical className="text-primary size-3.5" />} {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { data: papers } = usePapers();
  return (
    <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href="/dashboard" />
        <ThemeToggle />
      </div>
      <nav className="px-3">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/dashboard" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" /> Library
        </Link>
      </nav>
      <div className="text-muted-foreground mt-6 px-6 pb-2 text-[11px] font-medium tracking-widest uppercase">Recent papers</div>
      <div className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3">
        {papers?.slice(0, 12).map((paper) => {
          const active = pathname.startsWith(`/papers/${paper.id}`);
          return (
            <Link
              key={paper.id}
              href={`/papers/${paper.id}`}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
              )}
            >
              {active && <motion.span layoutId="sidebar-active" className="bg-sidebar-accent absolute inset-0 -z-10 rounded-lg" />}
              {paper.status === "ready" ? (
                <span className="bg-success size-1.5 shrink-0 rounded-full" />
              ) : paper.status === "failed" ? (
                <span className="bg-destructive size-1.5 shrink-0 rounded-full" />
              ) : (
                <Loader2 className="text-warning size-3 shrink-0 animate-spin" />
              )}
              <span className="line-clamp-1">{paper.title}</span>
            </Link>
          );
        })}
        {papers?.length === 0 && <p className="text-muted-foreground px-3 text-xs">Nothing here yet.</p>}
      </div>
      <div className="border-sidebar-border border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 border-border sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur lg:hidden">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu compact />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
