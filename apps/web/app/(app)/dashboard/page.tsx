"use client";

import { BookMarked } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Aurora } from "@/components/brand/aurora";
import { AddPaper } from "@/components/paper/add-paper";
import { PaperCard } from "@/components/paper/paper-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { usePapers } from "@/lib/hooks";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: papers, isLoading, error } = usePapers();
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  return (
    <div className="relative">
      <Aurora className="h-[28rem]" />
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8 sm:py-14">
        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-muted-foreground text-sm">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
            What are we <span className="font-display text-gradient italic">reading</span> today?
          </h1>
        </motion.header>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
          <AddPaper />
        </motion.div>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-semibold">Your library</h2>
            {papers && <span className="text-muted-foreground text-sm">{papers.length} {papers.length === 1 ? "paper" : "papers"}</span>}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-2xl p-4 text-sm">{error.message}</div>
          )}

          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}
            </div>
          ) : papers && papers.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="animate-float bg-gradient-brand mb-5 grid size-16 place-items-center rounded-3xl text-white shadow-xl shadow-primary/30">
                <BookMarked className="size-8" />
              </div>
              <h3 className="text-xl font-semibold">Your library is empty</h3>
              <p className="text-muted-foreground mt-1.5 max-w-sm text-sm">
                Add a PDF or paste an arXiv link above. Try <code className="font-mono">1706.03762</code> to meet the Transformer.
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {papers?.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
