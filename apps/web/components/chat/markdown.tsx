"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import type { Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

const CITE_PREFIX = "#cite-";

/** Turns inline [E1] markers into links the renderer below shows as chips. */
function linkCitations(text: string): string {
  return text.replace(/\[(E\d+)\]/g, (_, ref) => `[${ref}](${CITE_PREFIX}${ref})`);
}

interface MarkdownProps {
  children: string;
  citations?: Citation[];
  onCitationClick?: (citation: Citation) => void;
  className?: string;
}

function MarkdownImpl({ children, citations = [], onCitationClick, className }: MarkdownProps) {
  const components: Components = {
    a({ href, children: label }) {
      if (href?.startsWith(CITE_PREFIX)) {
        const ref = href.slice(CITE_PREFIX.length);
        const citation = citations.find((c) => c.ref === ref);
        return (
          <button
            type="button"
            title={citation ? `${citation.section} · p. ${citation.page_start}` : ref}
            disabled={!citation}
            onClick={() => citation && onCitationClick?.(citation)}
            className="bg-primary/15 text-primary hover:bg-primary/30 mx-0.5 inline-flex h-[1.3em] min-w-[1.6em] translate-y-[-0.1em] items-center justify-center rounded-md px-1 align-middle text-[0.72em] font-semibold transition-colors disabled:opacity-50"
          >
            {label}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    },
  };

  return (
    <div className={cn("prose-chat", className)}>
      {/* No rehype-raw: PDF-derived or model text can never become executable HTML. */}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {linkCitations(children)}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
