import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-brand relative grid size-8 place-items-center rounded-xl text-white shadow-lg shadow-primary/30",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[60%]" aria-hidden>
        <path d="M7 3.5h7.5L19 8v12.5H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3.5V8.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 13.5l1.7 1.7 3.3-3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark className="transition-transform group-hover:rotate-[-6deg] group-hover:scale-105" />
      <span className="text-lg font-semibold tracking-tight">
        Paper<span className="font-display text-gradient text-xl italic">Pal</span>
      </span>
    </Link>
  );
}
