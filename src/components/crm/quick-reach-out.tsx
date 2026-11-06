"use client";

import { useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import { LinkedInIcon } from "./linkedin-icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { quickCheckIn } from "@/app/actions";
import { whatsappHref } from "@/lib/crm";

/** Open WhatsApp/LinkedIn and log the touch in one tap, or just mark as done. */
export function QuickReachOut({
  id,
  phone,
  linkedinUrl,
}: {
  id: string;
  phone: string | null;
  linkedinUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const wa = whatsappHref(phone);

  const log = (kind: string, msg: string) =>
    start(async () => {
      await quickCheckIn(id, kind);
      toast.success(msg);
    });

  return (
    <div className="flex gap-1">
      {wa && (
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Message on WhatsApp and log it"
          title="WhatsApp (logs a check-in)"
          disabled={pending}
          onClick={() => {
            window.open(wa, "_blank", "noopener");
            log("whatsapp", "Logged a WhatsApp check-in");
          }}
        >
          <MessageCircle />
        </Button>
      )}
      {linkedinUrl && (
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Open LinkedIn and log it"
          title="LinkedIn (logs a check-in)"
          disabled={pending}
          onClick={() => {
            window.open(linkedinUrl, "_blank", "noopener");
            log("linkedin", "Logged a LinkedIn check-in");
          }}
        >
          <LinkedInIcon />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Mark as contacted today"
        title="Mark as contacted today"
        disabled={pending}
        onClick={() => log("other", "Marked as contacted today")}
      >
        <Check />
      </Button>
    </div>
  );
}
