import { cn } from "@/lib/utils";

/** Grey placeholder block shown while a page loads. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />;
}
