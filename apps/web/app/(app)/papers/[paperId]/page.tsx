"use client";

import { ArrowLeft, ExternalLink, FileText, LayoutList, MessageSquare, Network } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { Overview } from "@/components/paper/overview";
import { PdfViewer } from "@/components/paper/pdf-viewer";
import { ProcessingView } from "@/components/paper/processing-view";
import { StatusBadge } from "@/components/paper/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaper } from "@/lib/hooks";
import type { Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "pdf" | "chat";

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText; mobileOnly?: boolean }> = [
  { id: "overview", label: "Overview", icon: LayoutList },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare, mobileOnly: true },
];

export default function PaperPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const { data: paper, isLoading, error } = usePaper(paperId);
  const [tab, setTab] = useState<Tab>("overview");
  const [pdfPage, setPdfPage] = useState<number>();

  function openPage(page: number) {
    setPdfPage(page);
    setTab("pdf");
  }
  const openCitation = (c: Citation) => openPage(c.page_start);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }
  if (error || !paper) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-8 text-center">
        <div>
          <h2 className="text-xl font-semibold">Paper not found</h2>
          <p className="text-muted-foreground mt-1 text-sm">{error?.message ?? "It may have been deleted."}</p>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Back to library</Link>
        </div>
      </div>
    );
  }

  const ready = paper.status === "ready";
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3">
        <Link href="/dashboard" aria-label="Back to library" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-1 text-base font-semibold sm:text-lg">{paper.title}</h1>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {paper.authors.length ? paper.authors.slice(0, 4).join(", ") + (paper.authors.length > 4 ? " et al." : "") : "Uploaded PDF"}
          </p>
        </div>
        <StatusBadge status={paper.status} className="hidden sm:inline-flex" />
        {paper.source_url && (
          <a href={paper.source_url} target="_blank" rel="noopener noreferrer" aria-label="Open source" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ExternalLink className="size-4" />
          </a>
        )}
        {ready && (
          <Link href={`/papers/${paper.id}/graph`} className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            <Network className="size-4" /> <span className="hidden sm:inline">Related</span>
          </Link>
        )}
      </header>

      {!ready ? (
        <div className="min-h-0 flex-1"><ProcessingView paper={paper} /></div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className={cn("border-border flex min-h-0 flex-col lg:border-r", tab === "chat" && "hidden lg:flex")}>
            <div className="border-border flex gap-1 border-b px-3 py-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    t.mobileOnly && "lg:hidden",
                    tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === t.id && <motion.span layoutId="paper-tab" className="bg-accent absolute inset-0 rounded-lg" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <t.icon className="relative size-4" /> <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              {tab !== "pdf" ? (
                <Overview paper={paper} onJumpToPage={openPage} />
              ) : (
                <div className="h-full p-3"><PdfViewer paperId={paper.id} page={pdfPage} /></div>
              )}
            </div>
          </section>
          <section className={cn("min-h-0", tab !== "chat" && "hidden lg:block")}>
            <ChatPanel paperId={paper.id} onOpenCitation={openCitation} />
          </section>
        </div>
      )}
    </div>
  );
}
