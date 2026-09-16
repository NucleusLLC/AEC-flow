"use client";

/**
 * The composer: pick a document type, fill its fields, watch the letter write
 * itself, edit the words if you want to, save.
 *
 * WHY THE PREVIEW IS THE POINT. These documents are not forms — they are
 * letters and instruments somebody signs. A form that hides the sentence it is
 * building produces a power of attorney nobody reads until it is at the notary.
 * So the right-hand column renders the actual paragraphs, from the same pure
 * function the printed sheet uses (`lib/general-documents/render.ts`), and
 * "Edit the wording" hands those paragraphs over as plain text.
 *
 * ONCE EDITED, THE TEXT IS THE DOCUMENT. Saving stores the paragraphs, not the
 * template: an issued document must read the same next year, whatever the
 * catalogue says by then.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Pencil, RotateCcw, Wand2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { catalogueByCategory, catalogueEntry } from "@/lib/general-documents/catalogue";
import { compose } from "@/lib/general-documents/render";
import { militaryDate } from "@/lib/building-permits/register";
import {
  DOCUMENT_CATEGORY_BLURB,
  DOCUMENT_CATEGORY_LABEL,
  type GeneralDocumentDTO,
  type GeneralDocumentInput,
} from "@/lib/general-documents/types";
import {
  createDocumentAction,
  updateDocumentAction,
} from "@/app/(app)/documents/general/actions";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export type PickerOption = { id: string; name: string };

export function DocumentComposer({
  mode,
  initial,
  initialType,
  clients,
  projects,
  firmName,
  today,
}: {
  mode: "new" | "edit";
  initial?: GeneralDocumentDTO;
  /** Preselected from the picker, e.g. /documents/general/new?type=poa */
  initialType?: string;
  clients: PickerOption[];
  projects: PickerOption[];
  firmName: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [docType, setDocType] = useState(initial?.docType ?? initialType ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [counterpartyName, setCounterpartyName] = useState(initial?.counterpartyName ?? "");
  const [counterpartyAddress, setCounterpartyAddress] = useState(initial?.counterpartyAddress ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? today);
  const [effectiveDate, setEffectiveDate] = useState(initial?.effectiveDate ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [titleOverride, setTitleOverride] = useState(mode === "edit" ? (initial?.title ?? "") : "");

  /** Set once the user takes the wording over; the template stops driving it. */
  const [bodyOverride, setBodyOverride] = useState<string | null>(
    mode === "edit" ? (initial?.body ?? []).join("\n\n") : null,
  );

  const entry = docType ? catalogueEntry(docType) : null;
  const client = clients.find((c) => c.id === clientId);
  const project = projects.find((p) => p.id === projectId);

  const context = useMemo(
    () => ({
      firmName,
      clientName: client?.name ?? initial?.clientName ?? null,
      projectName: project?.name ?? initial?.projectName ?? null,
      projectAddress: null,
      counterpartyName: counterpartyName || null,
      counterpartyAddress: counterpartyAddress || null,
      contactName: contactName || null,
      subject: subject || null,
      reference: reference || null,
      number: initial?.number ?? null,
      // Dates are filled into the prose the way the whole app writes a date —
      // 16 SEP 2026, not 2026-09-16. A letter that prints an ISO date beside a
      // letterhead that prints a real one looks like two different documents.
      issueDate: issueDate ? militaryDate(issueDate) : null,
      effectiveDate: effectiveDate ? militaryDate(effectiveDate) : null,
      expiryDate: expiryDate ? militaryDate(expiryDate) : null,
    }),
    [
      firmName,
      client?.name,
      project?.name,
      initial?.clientName,
      initial?.projectName,
      initial?.number,
      counterpartyName,
      counterpartyAddress,
      contactName,
      subject,
      reference,
      issueDate,
      effectiveDate,
      expiryDate,
    ],
  );

  const composed = useMemo(
    () => (entry ? compose(entry.key, context, values) : null),
    [entry, context, values],
  );

  const paragraphs = useMemo(() => {
    if (bodyOverride !== null) {
      return bodyOverride
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return composed?.body ?? [];
  }, [bodyOverride, composed]);

  const title = titleOverride.trim() || composed?.title || entry?.label || "";

  function setValue(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    setError(null);
    if (!entry) {
      setError("Choose a document type first.");
      return;
    }
    const payload: GeneralDocumentInput = {
      docType: entry.key,
      title,
      clientId: clientId || null,
      clientName: client?.name ?? initial?.clientName ?? null,
      projectId: projectId || null,
      projectName: project?.name ?? initial?.projectName ?? null,
      counterpartyName: counterpartyName || null,
      counterpartyAddress: counterpartyAddress || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      subject: subject || null,
      reference: reference || null,
      issueDate: issueDate || null,
      effectiveDate: effectiveDate || null,
      expiryDate: expiryDate || null,
      values,
      body: paragraphs,
      notes: notes || null,
    };
    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateDocumentAction(initial.id, payload)
          : await createDocumentAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/documents/general/${res.id}`);
      router.refresh();
    });
  }

  // ── The picker, when no type is chosen yet ────────────────────────────────
  if (!entry) {
    return (
      <div className="space-y-6">
        <TemplateNotice />
        {catalogueByCategory().map((group) => (
          <Card key={group.category}>
            <CardHeader
              title={DOCUMENT_CATEGORY_LABEL[group.category]}
              subtitle={DOCUMENT_CATEGORY_BLURB[group.category]}
            />
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {group.entries.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setDocType(e.key)}
                  className="rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-brand hover:bg-surface-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span className="text-sm font-medium text-fg">{e.label}</span>
                    {e.abbreviation ? (
                      <span className="font-mono text-[10px] text-faint">{e.abbreviation}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{e.summary}</p>
                </button>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  // ── The composer ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            {entry.label}
            {entry.abbreviation ? (
              <span className="ml-2 font-mono text-[11px] text-faint">{entry.abbreviation}</span>
            ) : null}
          </h3>
          <p className="text-xs text-muted">{entry.summary}</p>
        </div>
        {mode === "new" ? (
          <button
            type="button"
            onClick={() => setDocType("")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Choose another type
          </button>
        ) : null}
      </div>

      {entry.practiceNote ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {entry.practiceNote}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Who and what" subtitle="Filled into the letter as you type." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={input}>
                  <option value="">— none —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Project</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input}>
                  <option value="">— none —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {entry.counterpartyLabel ? (
                <>
                  <div>
                    <label className={label}>{entry.counterpartyLabel}</label>
                    <input
                      value={counterpartyName}
                      onChange={(e) => setCounterpartyName(e.target.value)}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Their address</label>
                    <input
                      value={counterpartyAddress}
                      onChange={(e) => setCounterpartyAddress(e.target.value)}
                      className={input}
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label className={label}>Addressed to (name)</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Their email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Our reference</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={`${input} font-mono`}
                />
              </div>
              <div>
                <label className={label}>Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Date of the document</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Effective from</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Until</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={input}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="The particulars"
              subtitle={`What this ${entry.label.toLowerCase()} needs to say.`}
            />
            <CardBody className="space-y-4">
              {entry.fields.map((f) => (
                <div key={f.key}>
                  <label className={label}>
                    {f.label}
                    {f.required ? <span className="ml-1 text-red-600">*</span> : null}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={field}
                    />
                  ) : f.type === "select" ? (
                    <select
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      className={input}
                    >
                      <option value="">— choose —</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={input}
                    />
                  )}
                  {f.help ? <p className="mt-1 text-[11px] text-faint">{f.help}</p> : null}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal notes" subtitle="Never printed on the document." />
            <CardBody>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
            </CardBody>
          </Card>
        </div>

        {/* The document as it will read */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader
              title="The document"
              subtitle={
                bodyOverride === null
                  ? "Written from the template as you fill the fields."
                  : "You are editing the wording — the fields no longer rewrite it."
              }
              action={
                bodyOverride === null ? (
                  <button
                    type="button"
                    onClick={() => setBodyOverride(paragraphs.join("\n\n"))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit the wording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBodyOverride(null)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                    title="Go back to the template wording — your edits are discarded"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Back to the template
                  </button>
                )
              }
            />
            <CardBody className="space-y-3">
              <div>
                <label className={label}>Title</label>
                <input
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  placeholder={composed?.title ?? entry.label}
                  className={input}
                />
              </div>

              {bodyOverride === null ? (
                <div className="space-y-2 rounded-lg border border-border bg-surface-2/40 p-3 text-sm leading-relaxed text-fg">
                  {paragraphs.length === 0 ? (
                    <p className="text-muted">Fill the particulars and the letter appears here.</p>
                  ) : (
                    paragraphs.map((p, i) => <p key={i}>{p}</p>)
                  )}
                </div>
              ) : (
                <textarea
                  rows={18}
                  value={bodyOverride}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  className={`${field} font-serif leading-relaxed`}
                  placeholder="One paragraph per block, separated by a blank line."
                />
              )}

              {composed && composed.missing.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Still needed before this can be issued:{" "}
                  {composed.missing.map((f) => f.label).join(", ")}.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : mode === "edit" ? "Save draft" : "Create draft"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <TemplateNotice />
        </div>
      </div>
    </div>
  );
}

/**
 * Said once on the picker and once beside the save button, and never printed on
 * the document itself: these are the practice's own letters, not ours.
 */
function TemplateNotice() {
  return (
    <p className="text-xs text-faint">
      Templates are a starting point. A power of attorney, an NDA or a notice of termination has
      legal effect — have your lawyer read the wording once before you rely on it.
    </p>
  );
}
