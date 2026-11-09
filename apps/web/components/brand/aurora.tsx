import { cn } from "@/lib/utils";

/** Soft animated gradient blobs plus a fading grid; purely decorative. */
export function Aurora({ className, grid = true }: { className?: string; grid?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]", className)}>
      <div className="animate-aurora absolute -top-1/3 left-1/2 size-[60rem] -translate-x-1/2 rounded-full bg-aurora-1/25 blur-[120px]" />
      <div
        className="animate-aurora absolute top-1/4 -left-40 size-[34rem] rounded-full bg-aurora-3/20 blur-[110px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-aurora absolute top-10 -right-32 size-[30rem] rounded-full bg-aurora-2/20 blur-[110px]"
        style={{ animationDelay: "-11s" }}
      />
      {grid && <div className="grid-bg absolute inset-0" />}
    </div>
  );
}
