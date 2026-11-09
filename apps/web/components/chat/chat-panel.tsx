"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Check,
  History,
  Loader2,
  MessageSquarePlus,
  Quote,
  SendHorizonal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Square,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, streamChat, toChatMessages } from "@/lib/api";
import { keys, useConversations } from "@/lib/hooks";
import type { ChatMessage, Citation, ExplanationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS: Array<{ id: ExplanationLevel; label: string; hint: string }> = [
  { id: "beginner", label: "Beginner", hint: "Plain language and analogies" },
  { id: "undergraduate", label: "Undergrad", hint: "Technical intuition" },
  { id: "graduate", label: "Graduate", hint: "Method details and assumptions" },
  { id: "expert", label: "Expert", hint: "Formal, with caveats" },
];

const SUGGESTIONS = [
  "Summarize this paper in plain terms",
  "How does the proposed method work?",
  "What datasets and results do they report?",
  "What are the limitations?",
  "Find related papers",
];

const STAGE_LABELS: Record<string, string> = {
  routing: "Understanding your question",
  retrieving: "Searching the paper",
  searching: "Searching arXiv and Semantic Scholar",
  writing: "Writing the answer",
  validating: "Checking citations",
  repairing: "Fixing citations",
};

const LEVEL_KEY = "paperpal.level";

function readLevel(): ExplanationLevel {
  try {
    const stored = localStorage.getItem(LEVEL_KEY) as ExplanationLevel | null;
    if (stored && LEVELS.some((l) => l.id === stored)) return stored;
  } catch {
    /* storage unavailable */
  }
  return "undergraduate";
}

function stripTag(text: string) {
  return text.replace(/^\s*\[INSUFFICIENT\]\s*/, "");
}

interface ChatPanelProps {
  paperId: string;
  disabled?: boolean;
  onOpenCitation: (citation: Citation) => void;
}

export function ChatPanel({ paperId, disabled, onOpenCitation }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [level, setLevel] = useState<ExplanationLevel>(readLevel);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { data: conversations } = useConversations(paperId, !disabled);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const chooseLevel = (next: ExplanationLevel) => {
    setLevel(next);
    try {
      localStorage.setItem(LEVEL_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const patchLast = useCallback((patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => {
    setMessages((all) => {
      const copy = [...all];
      const last = copy[copy.length - 1];
      if (last) copy[copy.length - 1] = { ...last, ...(typeof patch === "function" ? patch(last) : patch) };
      return copy;
    });
  }, []);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy || disabled) return;
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    setMessages((all) => [
      ...all,
      { id: `u-${Date.now()}`, role: "user", content: text, citations: [] },
      { id: `a-${Date.now()}`, role: "assistant", content: "", citations: [], streaming: true, stage: "routing" },
    ]);
    try {
      await streamChat(
        paperId,
        { question: text, explanation_level: level, conversation_id: conversationId },
        {
          onStatus: (stage) => patchLast({ stage }),
          onEvidence: (citations) => patchLast({ citations }),
          onToken: (token) => patchLast((m) => ({ content: m.content + token })),
          onFinal: (result) => {
            setConversationId(result.conversation_id);
            patchLast({
              id: result.message_id,
              content: result.answer,
              citations: result.citations,
              task: result.task,
              insufficient_evidence: result.insufficient_evidence,
              streaming: false,
              stage: undefined,
            });
            void queryClient.invalidateQueries({ queryKey: keys.conversations(paperId) });
          },
        },
        controller.signal,
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        patchLast((m) => ({ streaming: false, content: m.content || "Stopped." }));
      } else {
        patchLast({ streaming: false, error: true, content: (error as Error).message });
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  async function openConversation(id: string) {
    try {
      const conversation = await api.conversation(id);
      setMessages(toChatMessages(conversation));
      setConversationId(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function newChat() {
    abort.current?.abort();
    setMessages([]);
    setConversationId(null);
  }

  async function rate(message: ChatMessage, rating: "helpful" | "unhelpful") {
    try {
      await api.feedback(message.id, rating);
      setMessages((all) => all.map((m) => (m.id === message.id ? { ...m, rated: rating } : m)));
      toast.success("Thanks for the feedback");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-primary size-4" /> Research chat
        </div>
        <div className="flex items-center gap-1">
          {!!conversations?.length && (
            <DropdownMenu>
              <DropdownMenuTrigger className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs outline-none">
                <History className="size-3.5" /> History
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {conversations.slice(0, 8).map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => void openConversation(c.id)} className="justify-between gap-2">
                    <span className="line-clamp-1">{c.title}</span>
                    <button
                      aria-label="Delete conversation"
                      className="hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteConversation(c.id);
                        if (c.id === conversationId) newChat();
                        void queryClient.invalidateQueries({ queryKey: keys.conversations(paperId) });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" onClick={newChat} disabled={!messages.length}>
            <MessageSquarePlus className="size-3.5" /> New
          </Button>
        </div>
      </div>

      <div ref={scroller} className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center text-center">
            <div className="animate-float bg-gradient-brand mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-xl shadow-primary/30">
              <Sparkles className="size-7" />
            </div>
            <h3 className="font-display text-3xl">Ask the paper anything</h3>
            <p className="text-muted-foreground mt-1 mb-6 max-w-xs text-sm">Every answer links back to the passage it came from.</p>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={disabled}
                  onClick={() => void send(s)}
                  className="hover:border-primary/50 hover:bg-primary/5 rounded-full border px-3.5 py-1.5 text-xs transition-colors disabled:opacity-50"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onCitation={onOpenCitation} onRate={(r) => void rate(m, r)} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="border-border space-y-3 border-t p-3">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Explanation level">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={level === l.id}
              title={l.hint}
              onClick={() => chooseLevel(l.id)}
              className={cn(
                "relative rounded-full px-3 py-1 text-xs font-medium transition-colors",
                level === l.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {level === l.id && <motion.span layoutId="level-pill" className="bg-primary absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
              <span className="relative">{l.label}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="bg-muted/50 focus-within:ring-ring/50 focus-within:border-primary/50 flex items-end gap-2 rounded-2xl border p-2 focus-within:ring-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            disabled={disabled}
            placeholder={disabled ? "Waiting for the paper to finish processing…" : "Ask about methods, results, limitations…"}
            aria-label="Your question"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => abort.current?.abort()} aria-label="Stop generating">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() || disabled} aria-label="Send" className="bg-gradient-brand border-0 text-white hover:opacity-90">
              <SendHorizonal className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCitation,
  onRate,
}: {
  message: ChatMessage;
  onCitation: (c: Citation) => void;
  onRate: (rating: "helpful" | "unhelpful") => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-end">
        <div className="bg-gradient-brand max-w-[88%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white shadow-md shadow-primary/20">
          {message.content}
        </div>
      </motion.div>
    );
  }

  const content = stripTag(message.content);
  const cited = message.citations.filter((c) => new RegExp(`\\[${c.ref}\\]`).test(content));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <span className="bg-gradient-brand mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white">
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {message.streaming && !content && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="text-primary size-4 animate-spin" />
            {STAGE_LABELS[message.stage ?? "routing"] ?? "Thinking"}…
          </div>
        )}
        {message.error ? (
          <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {message.content}
          </div>
        ) : (
          content && (
            <Markdown citations={message.citations} onCitationClick={onCitation}>
              {content}
            </Markdown>
          )
        )}
        {message.streaming && content && <span className="bg-primary inline-block h-4 w-1.5 animate-pulse rounded-sm align-middle" />}

        {message.insufficient_evidence && !message.streaming && (
          <div className="bg-warning/10 text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
            <AlertCircle className="size-3.5 shrink-0" /> The paper may not fully answer this — treat the response with care.
          </div>
        )}

        {!message.streaming && cited.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">Sources</div>
            {cited.map((c) => (
              <button
                key={c.chunk_id}
                onClick={() => onCitation(c)}
                className="border-border hover:border-primary/50 hover:bg-primary/5 group flex w-full gap-2.5 rounded-xl border p-2.5 text-left transition-colors"
              >
                <Quote className="text-primary mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 text-xs">
                  <span className="text-primary flex items-center gap-1.5 font-semibold">
                    <BookOpen className="size-3" /> {c.ref} · {c.section} · p. {c.page_start}
                    {c.page_end !== c.page_start ? `–${c.page_end}` : ""}
                  </span>
                  <span className="text-muted-foreground mt-0.5 line-clamp-2">{c.quote}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {!message.streaming && !message.error && message.id && !message.id.startsWith("a-") && (
          <div className="text-muted-foreground flex items-center gap-1">
            {message.rated ? (
              <span className="flex items-center gap-1 text-xs"><Check className="size-3.5" /> Thanks</span>
            ) : (
              <>
                <button aria-label="Helpful" onClick={() => onRate("helpful")} className="hover:bg-accent hover:text-foreground rounded-md p-1.5"><ThumbsUp className="size-3.5" /></button>
                <button aria-label="Not helpful" onClick={() => onRate("unhelpful")} className="hover:bg-accent hover:text-foreground rounded-md p-1.5"><ThumbsDown className="size-3.5" /></button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
