"use client";

import { ArrowLeft, ExternalLink, Info, Loader2, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CitationGraph, RELATION_STYLE } from "@/components/graph/citation-graph";
import { buttonVariants } from "@/components/ui/button";
import { useGraph, usePaper } from "@/lib/hooks";
import type { RelatedPaper } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = Object.keys(RELATION_STYLE) as Array<RelatedPaper["relation"]>;

export default function GraphPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const { data: paper } = usePaper(paperId);
  const { data: graph, isLoading, error, refetch } = useGraph(paperId);
  const [visible, setVisible] = useState(() => new Set(ALL));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => graph?.nodes.filter((n) => n.kind === "paper" && n.relation && visible.has(n.relation)) ?? [], [graph, visible]);
  const selected = graph?.nodes.find((n) => n.id === selectedId);

  const toggle = (relation: RelatedPaper["relation"]) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(relation)) next.delete(relation);
      else next.add(relation);
      return next;
    });

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3">
        <Link href={`/papers/${paperId}`} aria-label="Back to paper" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold sm:text-lg">Related research</h1>
          <p className="text-muted-foreground line-clamp-1 text-xs">{paper?.title}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {ALL.map((relation) => {
            const style = RELATION_STYLE[relation];
            const on = visible.has(relation);
            return (
              <button
                key={relation}
                aria-pressed={on}
                onClick={() => toggle(relation)}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all", on ? "bg-accent" : "text-muted-foreground opacity-60")}
              >
                <span className="w-4 border-t-2" style={{ borderColor: style.color, borderStyle: style.dashed ? "dashed" : "solid" }} />
                {style.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_22rem]">
        <div className="relative min-h-72 border-b lg:border-r lg:border-b-0">
          {isLoading ? (
            <div className="text-muted-foreground absolute inset-0 grid place-items-center">
              <div className="flex items-center gap-3 text-sm"><Loader2 className="text-primary size-5 animate-spin" /> Searching arXiv and Semantic Scholar…</div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="text-destructive text-sm">{error.message}</p>
                <button onClick={() => void refetch()} className={cn(buttonVariants({ variant: "outline" }), "mt-3")}>Try again</button>
              </div>
            </div>
          ) : graph ? (
            <>
              <CitationGraph graph={graph} visible={visible} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="glass absolute bottom-3 left-3 flex max-w-sm items-start gap-2 rounded-xl p-3 text-xs">
                <Info className="text-primary mt-0.5 size-4 shrink-0" /> {graph.notice}
              </div>
            </>
          ) : null}
        </div>

        <aside className="scrollbar-thin min-h-0 overflow-y-auto p-4" aria-label="Related papers list">
          <AnimatePresence>
            {selected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                <div className="border-primary/40 bg-primary/5 rounded-2xl border p-4">
                  <h3 className="text-sm leading-snug font-semibold">{selected.title}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">{selected.year ?? "n.d."}</p>
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 gap-1.5")}>
                      Open source <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <h2 className="text-muted-foreground mb-3 text-[11px] font-medium tracking-widest uppercase">{items.length} papers</h2>
          <ul className="space-y-2">
            {items.map((node, i) => {
              const style = RELATION_STYLE[node.relation!];
              return (
                <motion.li key={node.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
                  <button
                    onClick={() => setSelectedId(node.id)}
                    className={cn("hover:bg-accent w-full rounded-xl border p-3 text-left transition-colors", node.id === selectedId && "border-primary bg-primary/5")}
                  >
                    <span className="line-clamp-2 text-sm leading-snug font-medium">{node.title}</span>
                    <span className="text-muted-foreground mt-1.5 flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ background: style.color }} />
                      {style.label}
                      {node.relation !== "similar_to" && <ShieldCheck className="text-success size-3.5" aria-label="Verified" />}
                      <span className="ml-auto">{node.year}</span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
