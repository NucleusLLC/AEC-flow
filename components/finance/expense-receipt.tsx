"use client";

/**
 * The receipt on one expense: see it, save it, and — while the expense can
 * still be changed — attach, replace or remove it.
 *
 * The upload is the drawing-intake path (lib/server/storage.ts): ask the server
 * for a signed URL, PUT the bytes straight to the private bucket, then ask the
 * server to record them. The file never passes through a server function, and
 * the server re-checks everything the browser checked here.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { RECEIPT_ACCEPT, formatReceiptSize, validateReceipt } from "@/lib/finance/receipt";
import type { ExpenseReceiptDTO } from "@/lib/finance/types";
import {
  attachReceiptAction,
  createReceiptUploadTicketAction,
  discardReceiptUploadAction,
  removeReceiptAction,
} from "@/app/(app)/finance/expenses/actions";

const PREVIEWABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ExpenseReceipt({
  expenseId,
  receipt,
  canView,
  canChange,
}: {
  expenseId: string;
  receipt: ExpenseReceiptDTO | null;
  canView: boolean;
  canChange: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const href = `/finance/expenses/${expenseId}/receipt`;

  async function upload(file: File) {
    setError(null);
    const verdict = validateReceipt({ name: file.name, size: file.size, type: file.type });
    if (!verdict.ok) {
      setError(t(verdict.message));
      return;
    }
    setBusy(true);
    try {
      const res = await createReceiptUploadTicketAction(expenseId, {
        filename: file.name,
        mimeType: verdict.mimeType,
        sizeBytes: file.size,
      });
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      const put = await fetch(res.ticket.uploadUrl, {
        method: "PUT",
        headers: res.ticket.headers,
        body: file,
      });
      if (!put.ok) {
        await discardReceiptUploadAction(expenseId, res.ticket.storageKey);
        setError(t("The upload did not finish. Try again."));
        return;
      }
      const saved = await attachReceiptAction(expenseId, {
        storageKey: res.ticket.storageKey,
        filename: file.name,
      });
      if (!saved.ok) {
        setError(t(saved.error));
        return;
      }
      router.refresh();
    } catch {
      setError(t("The upload did not finish. Try again."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    if (!window.confirm(t("Remove this receipt? The file is deleted."))) return;
    setError(null);
    startTransition(async () => {
      const res = await removeReceiptAction(expenseId);
      if (!res.ok) setError(t(res.error));
      else router.refresh();
    });
  }

  const working = busy || pending;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-faint" />
          <h3 className="text-sm font-semibold text-fg">{t("Receipt")}</h3>
        </div>

        {receipt ? (
          <div className="flex flex-wrap items-center gap-3">
            {canView && PREVIEWABLE.has(receipt.mimeType) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL behind a redirect; next/image would cache it */}
                <img
                  src={href}
                  alt={t("Receipt")}
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
              </a>
            ) : (
              <FileText className="h-8 w-8 shrink-0 text-faint" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{receipt.filename}</div>
              <div className="text-[11px] text-faint">{formatReceiptSize(receipt.sizeBytes)}</div>
            </div>
            {canView ? (
              <div className="flex items-center gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-fg hover:bg-surface-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {t("View")}
                </a>
                <a
                  href={`${href}?download=1`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-fg hover:bg-surface-2"
                >
                  <Download className="h-3.5 w-3.5" /> {t("Download")}
                </a>
              </div>
            ) : (
              <span className="text-[11px] text-faint">
                {t("Only the person who recorded it or an administrator can open it.")}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("No receipt attached.")}</p>
        )}

        {canChange ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept={RECEIPT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={working}
              onClick={() => input.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {busy ? t("Uploading…") : receipt ? t("Replace receipt") : t("Attach a receipt")}
            </button>
            {receipt ? (
              <button
                type="button"
                disabled={working}
                onClick={remove}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:text-red-600 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("Remove")}
              </button>
            ) : null}
            <span className="text-[11px] text-faint">
              {fmt(t("A photo (JPEG, PNG, WebP, HEIC) or a PDF, up to {size}."), { size: "10 MB" })}
            </span>
          </div>
        ) : receipt ? null : (
          <p className="text-[11px] text-faint">
            {t("This expense can no longer be changed, so a receipt cannot be attached.")}
          </p>
        )}

        {error ? (
          <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
