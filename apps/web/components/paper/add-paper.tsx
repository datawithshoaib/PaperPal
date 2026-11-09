"use client";

import { ArrowUpRight, FileUp, Link2, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddPaper } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function AddPaper() {
  const router = useRouter();
  const add = useAddPaper();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [arxiv, setArxiv] = useState("");

  function submit(input: { file: File } | { arxiv: string }, onDone?: () => void) {
    add.mutate(input, {
      onSuccess: ({ paper }) => {
        toast.success("Paper added — processing has started.");
        onDone?.();
        router.push(`/papers/${paper.id}`);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function handleFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Please choose a PDF file.");
    submit({ file });
  }

  return (
    <div className="glass rounded-3xl p-3 shadow-xl shadow-black/5">
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <motion.label
          animate={{ scale: dragging ? 1.015 : 1 }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "group relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-primary/5",
            add.isPending && "pointer-events-none opacity-70",
          )}
        >
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
          <span className="bg-gradient-brand grid size-12 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30 transition-transform group-hover:-translate-y-1">
            {add.isPending && add.variables && "file" in add.variables ? <Loader2 className="size-5 animate-spin" /> : <FileUp className="size-5" />}
          </span>
          <span className="font-medium">Drop a PDF here, or <span className="text-primary underline underline-offset-4">browse</span></span>
          <span className="text-muted-foreground text-xs">Up to 25 MB · text-based PDFs</span>
        </motion.label>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (arxiv.trim()) submit({ arxiv: arxiv.trim() }, () => setArxiv(""));
          }}
          className="bg-muted/40 flex flex-col justify-center gap-3 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="text-primary size-4" /> Import from arXiv
          </div>
          <Input
            value={arxiv}
            onChange={(e) => setArxiv(e.target.value)}
            placeholder="arxiv.org/abs/1706.03762 or 1706.03762"
            aria-label="arXiv link or ID"
            className="h-10"
          />
          <Button type="submit" disabled={add.isPending || !arxiv.trim()} className="h-10 gap-1.5">
            {add.isPending && add.variables && "arxiv" in add.variables ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
            Add paper
          </Button>
        </form>
      </div>
    </div>
  );
}
