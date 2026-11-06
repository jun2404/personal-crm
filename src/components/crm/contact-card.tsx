import Link from "next/link";
import { Star } from "lucide-react";
import type { ContactRow } from "@/lib/server/data";
import { Avatar, DueText, RolePill, SourcePill } from "./bits";
import { QuickReachOut } from "./quick-reach-out";

export function ContactCard({ c, showReachOut = false }: { c: ContactRow; showReachOut?: boolean }) {
  const subtitle = [c.title, c.company].filter(Boolean).join(" · ");
  return (
    <li className="group relative flex min-w-0 items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40">
      <Avatar name={c.fullName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/contacts/${c.id}`}
            className="truncate font-medium after:absolute after:inset-0 after:content-['']"
          >
            {c.fullName}
          </Link>
          {c.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
        </div>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RolePill role={c.roleCategory} />
          <SourcePill source={c.source} />
          {c.eventName && (
            <span className="truncate text-[11px] text-muted-foreground">@ {c.eventName}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <DueText status={c.status} daysUntilDue={c.daysUntilDue} dueOn={c.dueOn} className="text-right" />
        {showReachOut && (
          <div className="relative z-10">
            <QuickReachOut id={c.id} phone={c.phone} linkedinUrl={c.linkedinUrl} />
          </div>
        )}
      </div>
    </li>
  );
}
