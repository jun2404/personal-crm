import { Bone } from "@/components/crm/skeleton";

// Shown the moment you tap +, so the app responds straight away while the form loads.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading the add contact form…</span>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Add contact</h1>
        <Bone className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4 w-24" />
            <Bone className="h-9 w-full" />
          </div>
        ))}
        <Bone className="h-10 w-full sm:w-40" />
      </div>
    </div>
  );
}
