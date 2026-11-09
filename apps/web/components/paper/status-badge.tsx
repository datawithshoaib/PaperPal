import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import type { PaperStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  parsing: "Reading PDF",
  embedding: "Indexing",
  analyzing: "Analyzing",
};

export function StatusBadge({ status, stage, className }: { status: PaperStatus; stage?: string; className?: string }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  if (status === "ready")
    return (
      <span className={cn(base, "bg-success/15 text-success", className)}>
        <CheckCircle2 className="size-3.5" /> Ready
      </span>
    );
  if (status === "failed")
    return (
      <span className={cn(base, "bg-destructive/15 text-destructive", className)}>
        <AlertTriangle className="size-3.5" /> Failed
      </span>
    );
  return (
    <span className={cn(base, "bg-warning/15 text-warning", className)}>
      <Loader2 className="size-3.5 animate-spin" /> {STAGE_LABELS[stage ?? "queued"] ?? "Processing"}
    </span>
  );
}
