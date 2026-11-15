import { Bone } from "@/components/crm/skeleton";

// Shown instantly when you open any page, while its data loads from the database.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-5 space-y-2">
        <Bone className="h-7 w-44" />
        <Bone className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Bone className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-40 max-w-full" />
              <Bone className="h-3 w-56 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
