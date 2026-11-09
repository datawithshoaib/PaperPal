"use client";

import { ArrowRight, FlaskConical, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Aurora } from "@/components/brand/aurora";
import { ProductMock } from "@/components/landing/product-mock";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40">
      <Aurora />
      <div className="mx-auto max-w-6xl px-5">
        <motion.div variants={container} initial="hidden" animate="show" className="mx-auto max-w-3xl text-center">
          <motion.div variants={item} className="mb-6 flex justify-center">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
              <Sparkles className="text-aurora-3 size-3.5" />
              Evidence-grounded answers · Powered by Groq + LangGraph
            </span>
          </motion.div>
          <motion.h1
            variants={item}
            className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
          >
            Read papers the way <span className="font-display text-gradient italic">researchers think.</span>
          </motion.h1>
          <motion.p variants={item} className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg text-pretty">
            Drop in a PDF or an arXiv link. PaperPal breaks it down, answers your hardest questions, and shows the exact
            passage behind every claim.
          </motion.p>
          <motion.div variants={item} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-gradient-brand h-11 gap-2 border-0 px-6 text-base text-white shadow-xl shadow-primary/30 hover:opacity-90")}>
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link href="/login?demo=1" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 gap-2 px-6 text-base")}>
              <FlaskConical className="size-4" /> Try the demo account
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 12 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.55, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: 1400 }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <div className="bg-gradient-brand absolute inset-x-10 -top-4 h-40 rounded-full opacity-40 blur-3xl" aria-hidden />
          <ProductMock />
        </motion.div>
      </div>
    </section>
  );
}
