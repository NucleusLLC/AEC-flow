"use client";

import { useEffect, useState } from "react";
import { Eye, X, Printer } from "lucide-react";
import type { ProposalRecord } from "@/lib/data/proposals.types";
import { ProposalDocument } from "./proposal-document";

/**
 * In-app preview of the rendered Fee Proposal document. Available from every
 * proposal area (list, by-client, detail, and the live editor) so the team
 * always sees exactly what the client receives before it goes out.
 */
export function ProposalPreviewModal({
  proposal,
  open,
  onClose,
  printHref,
}: {
  proposal: ProposalRecord | null;
  open: boolean;
  onClose: () => void;
  printHref?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !proposal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${proposal.refNumber}`}
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <Eye className="h-5 w-5 text-white/80" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{proposal.title || "Untitled proposal"}</div>
          <div className="truncate text-[11px] text-white/60">
            {proposal.refNumber} · Fee Proposal{proposal.revision > 1 ? ` · Rev ${proposal.revision}` : ""}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {printHref ? (
            <a
              href={printHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print / PDF</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="flex flex-1 justify-center overflow-auto p-4 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-fit rounded-md shadow-2xl">
          <ProposalDocument proposal={proposal} />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        Live preview — this is the document the client receives. Esc to close.
      </div>
    </div>
  );
}

/** Self-contained Preview button that manages its own modal state. */
export function ProposalPreviewButton({
  proposal,
  printHref,
  label = "Preview",
  variant = "outline",
  iconOnly = false,
  className = "",
}: {
  proposal: ProposalRecord;
  printHref?: string;
  label?: string;
  variant?: "outline" | "ghost";
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const base =
    variant === "ghost"
      ? "inline-flex items-center justify-center gap-1.5 rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-brand"
      : "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface text-sm font-medium text-fg transition-colors hover:bg-surface-2";
  const size = iconOnly ? "h-8 w-8" : "h-9 px-3 text-sm";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        aria-label={`Preview ${proposal.refNumber}`}
        title="Preview proposal"
        className={`${base} ${size} ${className}`}
      >
        <Eye className={iconOnly ? "h-4 w-4" : "h-4 w-4"} />
        {iconOnly ? null : label}
      </button>
      <ProposalPreviewModal proposal={proposal} open={open} onClose={() => setOpen(false)} printHref={printHref} />
    </>
  );
}
