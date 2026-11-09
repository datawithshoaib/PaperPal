"use client";

import { motion } from "motion/react";

import { Aurora } from "@/components/brand/aurora";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";

const QUOTES = [
  { text: "I finally understand the math in section 3 — and I can see exactly where it came from.", who: "PhD student, ML" },
  { text: "Cut my literature review from a weekend to an afternoon.", who: "Research engineer" },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <Aurora />
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Logo />
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-5xl leading-[1.1] font-semibold tracking-tight"
          >
            Research, <span className="font-display text-gradient italic">understood.</span>
          </motion.h2>
          <div className="mt-10 space-y-4">
            {QUOTES.map((q, i) => (
              <motion.figure
                key={q.who}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.2, duration: 0.7 }}
                className="glass max-w-md rounded-2xl p-5"
              >
                <blockquote className="text-sm leading-relaxed">“{q.text}”</blockquote>
                <figcaption className="text-muted-foreground mt-2 text-xs">— {q.who}</figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">Every answer cites its source. Always.</p>
      </section>

      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="glass w-full max-w-md rounded-3xl p-7 shadow-2xl shadow-black/10 sm:p-9"
          >
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
