"use client";

import { ArrowUpRight, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";

import { StatusBadge } from "@/components/paper/status-badge";
import { useDeletePaper } from "@/lib/hooks";
import type { Paper } from "@/lib/types";

export function PaperCard({ paper, index }: { paper: Paper; index: number }) {
  const remove = useDeletePaper();
  const keywords = paper.analysis.keywords?.slice(0, 3) ?? [];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      className="group glass relative flex flex-col overflow-hidden rounded-3xl"
    >
      <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />
      <Link href={`/papers/${paper.id}`} className="flex flex-1 flex-col gap-3 p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center justify-between">
          <StatusBadge status={paper.status} />
          <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-5 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <h3 className="line-clamp-3 text-lg leading-snug font-semibold text-balance">{paper.title}</h3>
        <p className="text-muted-foreground line-clamp-1 text-sm">
          {paper.authors.length ? paper.authors.slice(0, 3).join(", ") + (paper.authors.length > 3 ? " et al." : "") : "Uploaded PDF"}
        </p>
        {paper.analysis.tldr && <p className="text-muted-foreground line-clamp-2 text-sm">{paper.analysis.tldr}</p>}
        {paper.error_code && <p className="text-destructive line-clamp-2 text-xs">{paper.error_code}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {keywords.map((k) => (
            <span key={k} className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-xs">{k}</span>
          ))}
        </div>
      </Link>
      <div className="border-border text-muted-foreground flex items-center justify-between border-t px-6 py-3 text-xs">
        <span>{paper.arxiv_id ? `arXiv · ${paper.arxiv_id}` : "PDF"}{paper.page_count ? ` · ${paper.page_count} pages` : ""}</span>
        <button
          aria-label={`Delete ${paper.title}`}
          className="hover:text-destructive rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Delete “${paper.title}”? This removes the PDF, index, and chats.`))
              remove.mutate(paper.id, { onSuccess: () => toast.success("Paper deleted"), onError: (e) => toast.error(e.message) });
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}
