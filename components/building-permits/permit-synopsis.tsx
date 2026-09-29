"use client";

/**
 * The AI SITREP at the top of a permit's Process Summary.
 *
 * Written on request (a button that never prints), so opening the summary
 * costs nothing and the printed page never carries a synopsis older than the
 * file. Until one is written the section does not print at all; once written
 * it prints as paragraph 1, and each point can be corrected in place before
 * printing — the model drafts, the architect signs.
 */
import { useState, useTransition } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import type { PermitSynopsis } from "@/lib/building-permits/synopsis";
import { permitSynopsisAction } from "@/app/(app)/design/building-permits/synopsis-actions";

function Points({ label, n, items }: { label: string; n: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 break-inside-avoid">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-700">
        {n} {label}
      </div>
      <ol className="mt-0.5 space-y-0.5 text-[10.5px] text-gray-900">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-7 shrink-0 font-mono text-gray-500">
              {n}
              {String.fromCharCode(97 + i)}.
            </span>
            <span contentEditable suppressContentEditableWarning className="outline-none focus:bg-yellow-50">
              {p}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PermitSynopsisBlock({ permitId }: { permitId: string }) {
  const t = useT();
  const [synopsis, setSynopsis] = useState<PermitSynopsis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function write() {
    setError(null);
    start(async () => {
      const res = await permitSynopsisAction(permitId);
      if (res.ok) setSynopsis(res.synopsis);
      else setError(t(res.error));
    });
  }

  if (!synopsis) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{t("AI synopsis (SITREP)")}</div>
            <p className="text-xs text-gray-500">
              {t(
                "Bottom line up front, situation, actions and risks, written from this file only. Nothing prints until you write it.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={write}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {pending ? t("Writing…") : t("Write synopsis with AI")}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between border-b border-gray-300 pb-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {t("Synopsis (SITREP)")}
        </h2>
        <span className="flex items-center gap-3 text-xs print:hidden">
          <button
            type="button"
            onClick={write}
            disabled={pending}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {pending ? t("Writing…") : t("Rewrite")}
          </button>
          <button
            type="button"
            onClick={() => setSynopsis(null)}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
            {t("Remove")}
          </button>
        </span>
      </div>
      <div className="mt-2 break-inside-avoid rounded border-l-4 border-gray-900 bg-gray-50 px-3 py-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-700">BLUF</div>
        <p contentEditable suppressContentEditableWarning className="text-[11px] font-medium text-gray-900 outline-none focus:bg-yellow-50">
          {synopsis.bluf}
        </p>
      </div>
      <Points n="1" label={t("Situation")} items={synopsis.situation} />
      <Points n="2" label={t("Actions required")} items={synopsis.actions} />
      <Points n="3" label={t("Risks")} items={synopsis.risks} />
      <p className="mt-2 text-[9px] italic text-gray-400">
        {t("Drafted by AI from the file on this page; check before relying on it.")}
      </p>
      {error ? <p className="mt-1 text-xs text-red-600 print:hidden">{error}</p> : null}
    </section>
  );
}
