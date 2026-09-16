"use client";

/**
 * The register's print links.
 *
 * They carry the register's live query string, so the sheet is the list that is
 * on screen — filters, grouping and sort included. Landscape first because that
 * is what the seven columns fit on; portrait is there for a punch file.
 *
 * Email is not here yet: sending the register goes through Settings once the
 * practice's mail is configured.
 */

import Link from "next/link";
import { Printer } from "lucide-react";

const BASE = "/print/design/building-permits";

export function PermitListActions({ query }: { query: string }) {
  const href = (orientation: "landscape" | "portrait") =>
    `${BASE}?${query ? `${query}&` : ""}orientation=${orientation}`;

  return (
    <div className="flex items-center gap-1.5">
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
