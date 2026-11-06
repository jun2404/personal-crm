// Shared domain constants and helpers (safe for both server and client).

export const SOURCES = [
  { value: "networking_event", label: "Networking event" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "offline_meetup", label: "Offline meetup" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral / intro" },
  { value: "other", label: "Other" },
] as const;

export const ROLE_CATEGORIES = [
  { value: "founder", label: "Founder / Co-founder" },
  { value: "c_suite", label: "C-suite (CEO, CMO…)" },
  { value: "investor", label: "Investor" },
  { value: "vp_director", label: "VP / Director / Head" },
  { value: "manager", label: "Manager / Lead" },
  { value: "professional", label: "Professional" },
  { value: "unknown", label: "Unknown" },
] as const;

export const INTERACTION_KINDS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "linkedin", label: "LinkedIn message" },
  { value: "email", label: "Email" },
  { value: "coffee", label: "Coffee / meal" },
  { value: "meeting", label: "Meeting" },
  { value: "event", label: "Met at an event" },
  { value: "other", label: "Other" },
] as const;

export const FOLLOW_UP_OPTIONS = [
  { value: 14, label: "Every 2 weeks" },
  { value: 30, label: "Every month" },
  { value: 60, label: "Every 2 months" },
  { value: 90, label: "Every 3 months" },
  { value: 180, label: "Every 6 months" },
  { value: 365, label: "Once a year" },
  { value: 0, label: "No reminders" },
] as const;

export const DUE_SOON_DAYS = 14;

const label = (list: readonly { value: string | number; label: string }[], v: unknown) =>
  list.find((x) => x.value === v)?.label;

export const sourceLabel = (v: string) => label(SOURCES, v) ?? v;
export const roleLabel = (v: string) => label(ROLE_CATEGORIES, v) ?? v;
export const kindLabel = (v: string) => label(INTERACTION_KINDS, v) ?? v;
export const followUpLabel = (v: number) => label(FOLLOW_UP_OPTIONS, v) ?? `Every ${v} days`;

export const isSource = (v: string) => SOURCES.some((s) => s.value === v);
export const isRole = (v: string) => ROLE_CATEGORIES.some((s) => s.value === v);
export const isKind = (v: string) => INTERACTION_KINDS.some((s) => s.value === v);

/** Guess a seniority bucket from a free-text job title. */
export function classifyTitle(title: string | null | undefined): string {
  const t = (title ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/\b(co[-\s]?founder|founder|founding partner)\b/.test(t)) return "founder";
  if (/\b(ceo|cto|cmo|coo|cfo|cpo|cro|cio|ciso|chro|chief|(?<!vice[-\s])president|owner|managing director)\b/.test(t))
    return "c_suite";
  if (/\b(investor|venture|angel|vc|general partner|managing partner|limited partner)\b/.test(t))
    return "investor";
  if (/\b(vp|svp|evp|vice president|director|head of|head)\b/.test(t)) return "vp_director";
  if (/\b(manager|lead|supervisor)\b/.test(t)) return "manager";
  return "professional";
}

/** Digits for wa.me links; keeps the leading country code. */
export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d.replace(/\D/g, "");
}

export function whatsappHref(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d.length >= 7 ? `https://wa.me/${d}` : null;
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length >= 5 ? `tel:${cleaned}` : null;
}

export function normalizeLinkedIn(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  // Canonical form so "linkedin.com/in/x/", "https://www.linkedin.com/in/x?trk=…" all match.
  const m = v.match(/linkedin\.com\/(in|company)\/([^/?#\s]+)/i);
  if (m) {
    let handle = m[2];
    try {
      handle = decodeURIComponent(handle);
    } catch {
      // keep it as typed
    }
    return `https://www.linkedin.com/${m[1].toLowerCase()}/${handle.toLowerCase()}`;
  }
  if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, "");
  if (/linkedin\.com/i.test(v)) return `https://${v.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  // Bare handle like "jane-doe-123"
  if (/^[\w-]+$/.test(v)) return `https://www.linkedin.com/in/${v}`;
  return v;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_HUES = [255, 200, 160, 30, 330, 290, 15, 120];
export function avatarHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

// ---- Dates (all as YYYY-MM-DD strings, compared in the user's timezone) ----

export function todayIn(timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatDate(iso: string | null | undefined, opts?: { short?: boolean }): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: opts?.short ? undefined : "numeric",
    timeZone: "UTC",
  });
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const abs = Math.abs(days);
  const unit =
    abs >= 365 ? `${Math.round(abs / 365)} yr` : abs >= 60 ? `${Math.round(abs / 30)} mo` : `${abs} days`;
  return days > 0 ? `in ${unit}` : `${unit} ago`;
}

export type FollowUpStatus = "overdue" | "due_soon" | "ok" | "off";

/** The date a contact is next due for a check-in, or null if reminders are off. */
export function nextDueDate(c: {
  followUpDays: number;
  lastContactedOn: string | null;
  metOn: string | null;
  createdAt: Date | string;
}): string | null {
  if (!c.followUpDays) return null;
  const created =
    typeof c.createdAt === "string" ? c.createdAt.slice(0, 10) : c.createdAt.toISOString().slice(0, 10);
  const base = c.lastContactedOn ?? c.metOn ?? created;
  return addDays(base, c.followUpDays);
}

export function followUpStatus(due: string | null, today: string): FollowUpStatus {
  if (!due) return "off";
  const diff = daysBetween(today, due);
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_DAYS) return "due_soon";
  return "ok";
}
