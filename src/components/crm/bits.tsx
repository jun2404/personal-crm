import { cn } from "@/lib/utils";
import {
  avatarHue,
  formatDate,
  initials,
  relativeDays,
  roleLabel,
  sourceLabel,
  type FollowUpStatus,
} from "@/lib/crm";

export function Avatar({ name, className }: { name: string; className?: string }) {
  const hue = avatarHue(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        "bg-[oklch(0.93_0.05_var(--h))] text-[oklch(0.38_0.12_var(--h))]",
        "dark:bg-[oklch(0.32_0.07_var(--h))] dark:text-[oklch(0.9_0.06_var(--h))]",
        className,
      )}
      style={{ ["--h" as string]: hue }}
    >
      {initials(name)}
    </span>
  );
}

const SOURCE_TONE: Record<string, string> = {
  networking_event: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  linkedin: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  offline_meetup: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  whatsapp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  referral: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  other: "bg-muted text-muted-foreground",
};

const ROLE_TONE: Record<string, string> = {
  founder: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  c_suite: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  investor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
};

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap";

export function SourcePill({ source }: { source: string }) {
  return <span className={cn(pill, SOURCE_TONE[source] ?? SOURCE_TONE.other)}>{sourceLabel(source)}</span>;
}

export function RolePill({ role }: { role: string }) {
  if (role === "unknown" || role === "professional") return null;
  return (
    <span className={cn(pill, ROLE_TONE[role] ?? "bg-muted text-muted-foreground")}>
      {roleLabel(role).replace(/ \(.*\)$/, "")}
    </span>
  );
}

export function TagPill({ tag }: { tag: string }) {
  return <span className={cn(pill, "border border-border text-muted-foreground")}>#{tag}</span>;
}

export function DueText({
  status,
  daysUntilDue,
  dueOn,
  className,
}: {
  status: FollowUpStatus;
  daysUntilDue: number | null;
  dueOn: string | null;
  className?: string;
}) {
  if (status === "off" || daysUntilDue === null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No reminder</span>;
  }
  const tone =
    status === "overdue"
      ? "text-red-600 dark:text-red-400"
      : status === "due_soon"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  const text =
    status === "overdue"
      ? `Overdue ${relativeDays(daysUntilDue).replace(" ago", "")}`
      : `Check in ${relativeDays(daysUntilDue)}`;
  return (
    <span className={cn("text-xs font-medium", tone, className)} title={`Due ${formatDate(dueOn)}`}>
      {text}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
