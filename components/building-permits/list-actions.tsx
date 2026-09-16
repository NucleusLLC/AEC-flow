"use client";

/**
 * The register's print links.
 *
 * They carry the register's live query string, so the sheet is the list that is
 * on screen — filters, grouping and sort included. Landscape first because that
 * is what the seven columns fit on; portrait is there for a punch file.
 *
 * Email uses the app's one send path (`EmailButton` → Resend → EmailLog), which
 * sends a signed-in link rather than an attachment: AEC-flow's documents are
 * produced by the browser's print dialog, so there is no file on the server to
 * enclose, and naming one would be a lie.
 */

import Link from "next/link";
import { Printer } from "lucide-react";
import { EmailButton } from "@/components/email/email-button";

const BASE = "/print/design/building-permits";

export function PermitListActions({
  query,
  scope,
  count,
}: {
  query: string;
  /** The filters in words, as the printed sheet's header states them. */
  scope: string;
  count: number;
}) {
  const href = (orientation: "landscape" | "portrait") =>
    `${BASE}?${query ? `${query}&` : ""}orientation=${orientation}`;

  return (
    <div className="flex items-center gap-1.5">
      <EmailButton
        subject={`Building Permit Register — ${scope}`}
        attachment="Building Permit Register"
        label="Email"
        relatedType="building-permit-register"
        linkPath={href("landscape")}
        defaultBody={`The building permit register (${scope}) — ${count} ${
          count === 1 ? "permit" : "permits"
        }.`}
      />
      <Link
        href={href("landscape")}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        title="Print the register as it is filtered here"
      >
        <Printer className="h-4 w-4" /> Print
      </Link>
      <Link
        href={href("portrait")}
        className="inline-flex h-9 items-center rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        title="Print the register in portrait"
      >
        Portrait
      </Link>
    </div>
  );
}
