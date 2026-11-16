import {
  CalendarDays,
  Coffee,
  Handshake,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  UserPlus,
  Users,
} from "lucide-react";
import { LinkedInIcon } from "@/components/crm/linkedin-icon";
import { daysBetween, formatDate } from "@/lib/crm";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string }>;

const KIND_ICONS: Record<string, IconType> = {
  whatsapp: MessageCircle,
  call: Phone,
  linkedin: LinkedInIcon,
  email: Mail,
  coffee: Coffee,
  meeting: Users,
  event: CalendarDays,
  other: MessageSquare,
};

export type TimelineTone = "saved" | "met" | "interaction";

const TONES: Record<TimelineTone, string> = {
  saved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  met: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  interaction: "bg-primary/10 text-primary",
};

export function timelineIcon(tone: TimelineTone, kind?: string): IconType {
  if (tone === "saved") return UserPlus;
  if (tone === "met") return Handshake;
  return KIND_ICONS[kind ?? "other"] ?? MessageSquare;
}

export type TimelineEntry = {
  key: string;
  tone: TimelineTone;
  kind?: string;
  title: React.ReactNode;
  /** Small grey line under the title: date, time, "via LinkedIn import"… */
  meta?: React.ReactNode;
  note?: string | null;
  /** Optional control on the right, e.g. a delete button. */
  action?: React.ReactNode;
};

export function TimelineList({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-4", className)}>
      {/* the connecting line, centred under the 28px icons */}
      <span aria-hidden className="absolute top-3 bottom-3 left-[13.5px] w-px bg-border" />
      {entries.map((e) => {
        const Icon = timelineIcon(e.tone, e.kind);
        return (
          <li key={e.key} className="relative flex items-start gap-3">
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                TONES[e.tone],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{e.title}</p>
              {e.meta && <p className="text-xs text-muted-foreground">{e.meta}</p>}
              {e.note && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{e.note}</p>}
            </div>
            {e.action && <div className="shrink-0">{e.action}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** "Today", "Yesterday", or "Mon, 10 Nov 2026". */
export function dayLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${weekday}, ${formatDate(date, { short: date.slice(0, 4) === today.slice(0, 4) })}`;
}
