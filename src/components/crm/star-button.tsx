"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleStar } from "@/app/actions";
import { cn } from "@/lib/utils";

export function StarButton({ id, starred }: { id: string; starred: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(starred);
  const [, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={optimistic ? "Unstar" : "Star as key contact"}
      aria-pressed={optimistic}
      title={optimistic ? "Unstar" : "Star as key contact"}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleStar(id);
        })
      }
    >
      <Star className={cn(optimistic && "fill-amber-400 text-amber-400")} />
    </Button>
  );
}
