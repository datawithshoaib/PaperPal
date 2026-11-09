"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Beaker, Flag, FlaskConical, Lightbulb, ListChecks, Loader2, RefreshCw, Sparkles, Target } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { keys, useSections } from "@/lib/hooks";
import type { Paper } from "@/lib/types";

function Card({ icon: Icon, title, children, index }: { icon: typeof Target; title: string; children: React.ReactNode; index: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl p-5"
    >
      <h3 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        <Icon className="text-primary size-4" /> {title}
      </h3>
      {children}
    </motion.section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-2 text-sm leading-relaxed">
    {items.map((item) => (
      <li key={item} className="flex gap-2.5">
        <span className="bg-gradient-brand mt-2 size-1.5 shrink-0 rounded-full" /> <span>{item}</span>
      </li>
    ))}
  </ul>
);

export function Overview({ paper, onJumpToPage }: { paper: Paper; onJumpToPage: (page: number) => void }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: sections } = useSections(paper.id, paper.status === "ready");
  const a = paper.analysis;

  async function reanalyze() {
    setRefreshing(true);
    try {
      const updated = await api.reanalyze(paper.id);
      queryClient.setQueryData(keys.paper(paper.id), updated);
      toast.success("Analysis refreshed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-brand relative overflow-hidden rounded-2xl p-6 text-white shadow-xl shadow-primary/20">
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-2 text-xs font-semibold tracking-widest uppercase opacity-80">
          <Sparkles className="size-3.5" /> In one sentence
        </div>
        <p className="font-display relative mt-2 text-2xl leading-snug">{a.tldr || paper.abstract.slice(0, 200)}</p>
      </motion.div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {a.keywords?.map((k) => (
            <span key={k} className="bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs">{k}</span>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={reanalyze} disabled={refreshing} className="shrink-0 gap-1.5">
          {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Re-analyze
        </Button>
      </div>
      {a.source === "extractive" && (
        <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-xs">
          Showing extracted passages. Add a <code className="font-mono">GROQ_API_KEY</code> on the API for an AI-written analysis.
        </p>
      )}

      {a.summary && <Card index={0} icon={Lightbulb} title="Summary"><p className="text-sm leading-relaxed">{a.summary}</p></Card>}
      {a.problem_statement && <Card index={1} icon={Target} title="Problem"><p className="text-sm leading-relaxed">{a.problem_statement}</p></Card>}
      {!!a.contributions?.length && <Card index={2} icon={Flag} title="Contributions"><List items={a.contributions} /></Card>}
      {a.methodology && <Card index={3} icon={FlaskConical} title="Methodology"><Markdown className="text-sm">{a.methodology}</Markdown></Card>}
      {a.experiments && <Card index={4} icon={Beaker} title="Experiments"><p className="text-sm leading-relaxed">{a.experiments}</p></Card>}
      {!!a.key_findings?.length && <Card index={5} icon={ListChecks} title="Key findings"><List items={a.key_findings} /></Card>}
      {!!a.limitations?.length && <Card index={6} icon={AlertTriangle} title="Limitations"><List items={a.limitations} /></Card>}

      {!!sections?.length && (
        <Card index={7} icon={ListChecks} title="Outline">
          <ol className="space-y-1">
            {sections.filter((s) => s.section_type !== "front_matter").map((s) => (
              <li key={`${s.title}-${s.page_start}`}>
                <button onClick={() => onJumpToPage(s.page_start)} className="hover:bg-accent flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors">
                  <span className="line-clamp-1">{s.title}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">p. {s.page_start}</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
