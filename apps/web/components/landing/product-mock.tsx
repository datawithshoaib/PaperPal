"use client";

import { BookOpen, FileText, Quote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const LEVELS = ["Beginner", "Undergrad", "Graduate", "Expert"] as const;
const ANSWERS: Record<(typeof LEVELS)[number], string> = {
  Beginner: "Think of attention as a spotlight: for every word, the model decides which other words matter most right now.",
  Undergrad: "Self-attention scores every token against every other token, then takes a weighted sum of their value vectors.",
  Graduate: "Scaled dot-product attention computes softmax(QKᵀ/√dₖ)V, enabling O(1) path length between any two positions.",
  Expert: "Multi-head attention projects into h subspaces; the 1/√dₖ scaling counteracts softmax saturation at large dₖ.",
};

export function ProductMock() {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLevel((l) => (l + 1) % LEVELS.length), 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass overflow-hidden rounded-3xl shadow-2xl shadow-black/30">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-amber-400/80" />
        <span className="size-3 rounded-full bg-emerald-400/80" />
        <span className="text-muted-foreground mx-auto flex items-center gap-1.5 text-xs">
          <FileText className="size-3.5" /> Attention Is All You Need
        </span>
      </div>
      <div className="grid md:grid-cols-[1fr_1.15fr]">
        <div className="border-border hidden space-y-4 border-r p-6 md:block">
          <div className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">TL;DR</div>
          <p className="text-sm leading-relaxed">
            The Transformer replaces recurrence with attention, reaching state-of-the-art translation quality with far
            less training time.
          </p>
          {["Self-attention only architecture", "Multi-head attention", "Positional encodings"].map((c, i) => (
            <motion.div
              key={c}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + i * 0.15 }}
              className="bg-muted/60 flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
            >
              <span className="bg-gradient-brand size-1.5 rounded-full" /> {c}
            </motion.div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {["transformers", "attention", "seq2seq"].map((k) => (
              <span key={k} className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-xs">{k}</span>
            ))}
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex justify-end">
            <div className="bg-gradient-brand max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white">
              How does attention work?
            </div>
          </div>
          <div className="flex gap-1.5">
            {LEVELS.map((l, i) => (
              <button
                key={l}
                onClick={() => setLevel(i)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  i === level ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="bg-muted/50 min-h-28 rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
            <AnimatePresence mode="wait">
              <motion.p
                key={level}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {ANSWERS[LEVELS[level]]}{" "}
                <span className="bg-primary/15 text-primary rounded-md px-1.5 py-0.5 text-xs font-semibold">E1</span>
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="border-primary/30 bg-primary/5 flex gap-3 rounded-xl border p-3">
            <Quote className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="text-xs leading-relaxed">
              <div className="text-primary mb-0.5 flex items-center gap-1.5 font-semibold">
                <BookOpen className="size-3" /> E1 · 3.2 Attention · p. 3
              </div>
              <span className="text-muted-foreground">“An attention function maps a query and a set of key-value pairs to an output…”</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
