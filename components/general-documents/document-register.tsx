"use client";

/**
 * The General Documents register: what the practice has written, for whom, and
 * where each one stands.
 *
 * Filtering and search are here because they are view state; nothing about a
 * document's meaning lives in this file. Dates print military style
 * (15 SEP 2026) to match the rest of the app's registers.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Inbox, Search } from "lucide-react";
import { DocumentStatusBadge } from "@/components/general-documents/badges";
import { militaryDate } from "@/lib/building-permits/register";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  GENERAL_DOCUMENT_STATUSES,
  GENERAL_DOCUMENT_STATUS_LABEL,
  type DocumentCategory,
  type GeneralDocumentStatus,
  type GeneralDocumentSummaryDTO,
} from "@/lib/general-documents/types";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function haystack(d: GeneralDocumentSummaryDTO): string {
  return [
    d.number,
    d.title,
    d.docTypeLabel,
    d.clientName,
    d.projectName,
    d.counterpartyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function DocumentRegister({
  documents,
  today,
}: {
  documents: GeneralDocumentSummaryDTO[];
  today: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<GeneralDocumentStatus | "ALL" | "LIVE">("ALL");
  const [category, setCategory] = useState<DocumentCategory | "ALL">("ALL");

  const rows = useMemo(
    () =>
      documents.filter((d) => {
        if (status === "LIVE") {
          // What is still in play: a draft being written, or something out there
          // awaiting signature. Superseded and void are history.
          if (d.status === "SUPERSEDED" || d.status === "VOID") return false;
        } else if (status !== "ALL" && d.status !== status) {
          return false;
        }
        if (category !== "ALL" && d.category !== category) return false;
        const needle = q.trim().toLowerCase();
        if (needle && !haystack(d).includes(needle)) return false;
        return true;
      }),
    [documents, status, category, q],
  );

  const expiringSoon = useMemo(
    () =>
      rows.filter(
        (d) =>
          d.expiryDate &&
          (d.status === "ISSUED" || d.status === "SIGNED") &&
          d.expiryDate >= today,
      ).length,
    [rows, today],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, title, client, project, addressee…"
            aria-label="Search documents"
            className={`${CONTROL} w-full pl-8 pr-3 placeholder:text-faint`}
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as GeneralDocumentStatus | "ALL" | "LIVE")}
          aria-label="Filter by status"
          className={CONTROL}
        >
          <option value="ALL">All statuses</option>
          <option value="LIVE">In play</option>
          {GENERAL_DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GENERAL_DOCUMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory | "ALL")}
          aria-label="Filter by kind"
          className={CONTROL}
        >
          <option value="ALL">All kinds</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DOCUMENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted tabular-nums">
          {rows.length} of {documents.length}
          {expiringSoon > 0 ? <span className="ml-1.5">· {expiringSoon} with an end date</span> : null}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">No document matches these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 pb-1.5 font-medium">Number</th>
                <th className="px-3 pb-1.5 font-medium">Document</th>
                <th className="px-3 pb-1.5 font-medium">For</th>
                <th className="px-3 pb-1.5 font-medium">Addressed to</th>
                <th className="px-3 pb-1.5 font-medium">Dated</th>
                <th className="px-3 pb-1.5 font-medium">Runs to</th>
                <th className="px-4 pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 align-top">
                    <Link
                      href={`/documents/general/${d.id}`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-brand hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {d.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="truncate font-medium text-fg" title={d.title}>
                      {d.title}
                    </div>
                    <div className="truncate text-[11px] text-faint">{d.docTypeLabel}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-muted">
                    <div className="truncate">{d.clientName ?? "—"}</div>
                    {d.projectName ? (
                      <div className="truncate text-[11px] text-faint">{d.projectName}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top text-muted">
                    <span className="truncate">{d.counterpartyName ?? d.clientName ?? "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                    {militaryDate(d.issueDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                    {militaryDate(d.expiryDate)}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <DocumentStatusBadge status={d.status} />
                    {d.signedAt ? (
                      <div className="mt-1 font-mono text-[10px] text-faint">
                        {militaryDate(d.signedAt)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
