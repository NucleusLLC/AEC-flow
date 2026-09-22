"use client";

import { useState, useTransition } from "react";
import { MailWarning, Check, Loader2, X } from "lucide-react";
import { resendVerificationAction } from "@/app/(app)/account/actions";

/**
 * "Confirm your email address", across the top of the app.
 *
 * It asks; it does not block. Locking someone out of a product they are already
 * paying attention to, because a queued email is slow or went to spam, costs more
 * than the risk it removes — and the risk is bounded: an unconfirmed address is
 * only a problem the day that person needs a password reset.
 *
 * Dismissable for the session, not for ever: it comes back on the next load,
 * because the reason for it has not gone away. Once the address IS confirmed the
 * server stops rendering it, so there is nothing to un-dismiss.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [hidden, setHidden] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (hidden) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <MailWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        Confirm <span className="font-semibold">{email}</span> so password resets and
        invitations can reach you.
      </span>
      {sent ? (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Email sent — check your inbox
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            await resendVerificationAction();
            // Always shown, whatever came back: "already verified" and "you have
            // asked five times this hour" are both answered by going to look.
            setSent(true);
          })}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 text-xs font-semibold hover:bg-amber-500/25 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Resend the link
        </button>
      )}
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Hide until next time"
        className="ml-auto shrink-0 rounded p-1 hover:bg-amber-500/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
