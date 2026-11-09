"use client";

import { AlertTriangle, Brain, Check, FileSearch, Loader2, RotateCcw, ScanText } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useJobStage, useRetryPaper } from "@/lib/hooks";
import type { Paper } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { stage: "parsing", label: "Reading the PDF", detail: "Extracting text and page layout", icon: ScanText },
  { stage: "embedding", label: "Indexing sections", detail: "Chunking and embedding into ChromaDB", icon: FileSearch },
  { stage: "analyzing", label: "Analyzing the paper", detail: "Summary, method, results, limitations", icon: Brain },
];

export function ProcessingView({ paper }: { paper: Paper }) {
  const failed = paper.status === "failed";
  const { data: job } = useJobStage(paper.job_id, !failed);
  const retry = useRetryPaper();
  const current = Math.max(0, STEPS.findIndex((s) => s.stage === job?.stage));

  if (failed) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-md text-center">
          <div className="bg-destructive/15 text-destructive mx-auto mb-4 grid size-14 place-items-center rounded-2xl">
            <AlertTriangle className="size-7" />
          </div>
          <h2 className="text-xl font-semibold">We couldn&apos;t process this paper</h2>
          <p className="text-muted-foreground mt-2 text-sm">{paper.error_code ?? "An unknown error occurred."}</p>
          {paper.job_id && (
            <Button
              className="mt-5 gap-2"
              disabled={retry.isPending}
              onClick={() => retry.mutate(paper.job_id!, { onError: (e) => toast.error(e.message) })}
            >
              {retry.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="w-full max-w-sm">
        <h2 className="mb-1 text-center text-2xl font-semibold">Preparing your paper</h2>
        <p className="text-muted-foreground mb-8 text-center text-sm">This usually takes under a minute.</p>
        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <motion.li
                key={step.stage}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
                className={cn("glass flex items-center gap-4 rounded-2xl p-4 transition-opacity", !done && !active && "opacity-50")}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", done ? "bg-success/20 text-success" : active ? "bg-gradient-brand text-white animate-pulse-ring" : "bg-muted text-muted-foreground")}>
                  {done ? <Check className="size-5" /> : active ? <Loader2 className="size-5 animate-spin" /> : <step.icon className="size-5" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{step.label}</span>
                  <span className="text-muted-foreground block text-xs">{step.detail}</span>
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
