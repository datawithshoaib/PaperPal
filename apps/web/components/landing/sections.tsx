"use client";

import {
  ArrowRight,
  FileSearch,
  GraduationCap,
  Network,
  ScanText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
  accent: string;
}

const FEATURES: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Every claim, cited",
    body: "Answers carry inline evidence IDs. The server validates each one against the passages actually retrieved, so a model can never cite something that isn't there.",
    className: "md:col-span-2",
    accent: "from-violet-500/20",
  },
  {
    icon: GraduationCap,
    title: "Four reading levels",
    body: "Beginner to expert, without changing the paper's claims.",
    accent: "from-pink-500/20",
  },
  {
    icon: ScanText,
    title: "Structured analysis",
    body: "Problem, contributions, method, results, and limitations extracted in seconds.",
    accent: "from-cyan-500/20",
  },
  {
    icon: Network,
    title: "Honest citation graph",
    body: "Topic similarity and verified citations are drawn differently, never conflated.",
    className: "md:col-span-2",
    accent: "from-emerald-500/20",
  },
];

const STEPS = [
  { icon: UploadCloud, title: "Add a paper", body: "Upload a PDF or paste an arXiv link." },
  { icon: FileSearch, title: "We index it", body: "Section-aware chunks go into a ChromaDB vector store." },
  { icon: Sparkles, title: "Ask anything", body: "A LangGraph agent routes, retrieves, answers, and verifies." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <motion.div {...reveal} className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Built for <span className="font-display text-gradient italic">trust,</span> not just speed.
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">
          PaperPal is a research tool first: it shows its work, and says so when the paper doesn&apos;t have the answer.
        </p>
      </motion.div>
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            className={cn("glass group relative overflow-hidden rounded-3xl p-7", f.className)}
          >
            <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100", f.accent)} />
            <div className="bg-gradient-brand mb-5 grid size-11 place-items-center rounded-2xl text-white shadow-lg shadow-primary/25">
              <f.icon className="size-5" />
            </div>
            <h3 className="text-xl font-semibold">{f.title}</h3>
            <p className="text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
      <motion.h2 {...reveal} className="mb-12 text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        From PDF to <span className="font-display text-gradient italic">understanding</span> in three steps
      </motion.h2>
      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="from-primary/0 via-primary/40 to-primary/0 absolute top-9 right-[16%] left-[16%] hidden h-px bg-gradient-to-r md:block" />
        {STEPS.map((s, i) => (
          <motion.div key={s.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.12 }} className="relative text-center">
            <div className="glass relative mx-auto mb-5 grid size-[4.5rem] place-items-center rounded-3xl">
              <s.icon className="text-primary size-7" />
              <span className="bg-gradient-brand absolute -top-2 -right-2 grid size-6 place-items-center rounded-full text-xs font-bold text-white">
                {i + 1}
              </span>
            </div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="text-muted-foreground mx-auto mt-1.5 max-w-60 text-sm">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <motion.div {...reveal} className="bg-gradient-brand relative overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white">
        <div className="animate-float absolute -top-20 -left-20 size-72 rounded-full bg-white/15 blur-3xl" />
        <div className="animate-float absolute -right-16 -bottom-24 size-72 rounded-full bg-white/10 blur-3xl" style={{ animationDelay: "-4s" }} />
        <h2 className="relative text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Your next paper is <span className="font-display italic">a conversation away.</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-lg text-lg text-white/80">
          Sign in with Google, or jump into the demo account with a sample paper already loaded.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 bg-white px-6 text-base text-zinc-900 hover:bg-white/90")}>
            Create your account <ArrowRight className="size-4" />
          </Link>
          <Link href="/login?demo=1" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 px-6 text-base text-white hover:bg-white/15 hover:text-white")}>
            Use the demo account
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm sm:flex-row">
        <span className="flex items-center gap-2"><LogoMark className="size-6 rounded-lg" /> PaperPal · Evidence first</span>
        <span>Built with Next.js, FastAPI, LangGraph, Groq &amp; ChromaDB</span>
      </div>
    </footer>
  );
}
