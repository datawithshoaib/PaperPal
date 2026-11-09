"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, loading } = useAuth();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300",
          scrolled ? "glass shadow-lg shadow-black/10" : "border border-transparent",
        )}
      >
        <Logo />
        <div className="text-muted-foreground hidden items-center gap-7 text-sm font-medium md:flex">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {!loading &&
            (user ? (
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden sm:inline-flex")}>Sign in</Link>
                <Link href="/signup" className={buttonVariants({ size: "lg" })}>Get started</Link>
              </>
            ))}
        </div>
      </nav>
    </motion.header>
  );
}
