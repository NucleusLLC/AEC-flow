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
import { AlertTriangle, FileText, Loader2, Pencil, RotateCcw, Sparkles, Wand2 } from "lucide-react";
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
  draftWithAiAction,
  updateDocumentAction,
} from "@/app/(app)/documents/general/actions";
import {
  AI_DRAFT_KINDS,
  AI_DRAFT_KIND_LABEL,
  AI_DRAFT_LANGUAGES,
  AI_DRAFT_LANGUAGE_LABEL,
  AI_DRAFT_STYLES,
  AI_DRAFT_STYLE_BLURB,
  AI_DRAFT_STYLE_LABEL,
  AI_DRAFT_TYPE,
  SUMMARY_MAX,
  SUMMARY_MIN,
  isAiDraftKind,
  type AiDraftKind,
  type AiDraftLanguage,
  type AiDraftRequest,
  type AiDraftStyle,
} from "@/lib/general-documents/ai-draft";
import { useLanguage, useT } from "@/components/i18n/language-provider";
import { ClientSelect } from "@/components/clients/client-select";
import { A4Sheet } from "@/components/general-documents/a4-sheet";
import { ProjectSelect } from "@/components/projects/project-select";
import { fmt } from "@/lib/i18n/format";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export type PickerOption = { id: string; name: string };

export function DocumentComposer({
  mode,
  initial,
  initialType,
  clients: clientsOnFile,
  projects: projectsOnFile,
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
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [docType, setDocType] = useState(initial?.docType ?? initialType ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  // Grown in place when a client or project is added from this form, so the
  // new record is selected and named in the letter without a reload.
  const [clients, setClients] = useState<PickerOption[]>(clientsOnFile);
  const [projects, setProjects] = useState<PickerOption[]>(projectsOnFile);
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

  // ── Write it with AI ─────────────────────────────────────────────────────
  // What the draft was asked for is kept on the row's values, so an AI document
  // reopened for editing shows the same summary and can be rewritten.
  const { lang } = useLanguage();
  const saved = initial?.values ?? {};
  const [aiSummary, setAiSummary] = useState(saved.aiSummary ?? "");
  const [aiKind, setAiKind] = useState<AiDraftKind>(
    isAiDraftKind(saved.aiKind) ? saved.aiKind : "LETTER",
  );
  const [aiStyle, setAiStyle] = useState<AiDraftStyle>(
    (AI_DRAFT_STYLES as string[]).includes(saved.aiStyle ?? "")
      ? (saved.aiStyle as AiDraftStyle)
      : "MILITARY",
  );
  const [aiLanguage, setAiLanguage] = useState<AiDraftLanguage | "">(
    (AI_DRAFT_LANGUAGES as string[]).includes(saved.aiLanguage ?? "")
      ? (saved.aiLanguage as AiDraftLanguage)
      : "",
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMissing, setAiMissing] = useState<string[]>([]);
  /** Until the user picks one, the document is written in the language they are using. */
  const draftLanguage: AiDraftLanguage = aiLanguage || lang;

  const entry = docType ? catalogueEntry(docType) : null;
  const isAi = entry?.key === AI_DRAFT_TYPE;
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

  async function writeWithAi() {
    setError(null);
    if (aiSummary.trim().length < SUMMARY_MIN) {
      setError(`Describe the document in at least ${SUMMARY_MIN} characters.`);
      return;
    }
    const request: AiDraftRequest = {
      summary: aiSummary,
      kind: aiKind,
      style: aiStyle,
      language: draftLanguage,
      context: {
        firmName,
        clientName: client?.name ?? initial?.clientName ?? null,
        projectName: project?.name ?? initial?.projectName ?? null,
        counterpartyName: counterpartyName || null,
        counterpartyAddress: counterpartyAddress || null,
        contactName: contactName || null,
        subject: subject || null,
        reference: reference || null,
        date: issueDate ? militaryDate(issueDate) : null,
      },
    };
    setAiBusy(true);
    try {
      const res = await draftWithAiAction(request);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitleOverride(res.draft.title);
      if (!subject.trim() && res.draft.subject) setSubject(res.draft.subject);
      setBodyOverride(res.draft.paragraphs.join("\n\n"));
      setValues(res.values);
      setAiMissing(res.draft.missing);
    } catch {
      setError("The document could not be written. Try again.");
    } finally {
      setAiBusy(false);
    }
  }

  function save() {
    setError(null);
    if (!entry) {
      setError("Choose a document type first.");
      return;
    }
    if (isAi && paragraphs.length === 0) {
      setError("Write the document first: describe it and click Write it with AI.");
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
      // An AI document keeps what it was asked for, as the form reads now.
      values: isAi
        ? { ...values, aiSummary, aiKind, aiStyle, aiLanguage: draftLanguage }
        : values,
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
        <button
          type="button"
          onClick={() => setDocType(AI_DRAFT_TYPE)}
          className="flex w-full items-start gap-3 rounded-xl border border-brand/40 bg-brand/5 px-4 py-3 text-left transition-colors hover:border-brand hover:bg-brand/10"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <span>
            <span className="block text-sm font-semibold text-fg">{t("Write anything with AI")}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {t(
                "Any letter, memo, notice or request: type a short summary, click Write it with AI, and the complete document is written for you to read and edit.",
              )}
            </span>
          </span>
        </button>
        <TemplateNotice />
        {catalogueByCategory().map((group) => (
          <Card key={group.category}>
            <CardHeader
              title={t(DOCUMENT_CATEGORY_LABEL[group.category])}
              subtitle={t(DOCUMENT_CATEGORY_BLURB[group.category])}
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
                    <span className="text-sm font-medium text-fg">{t(e.label)}</span>
                    {e.abbreviation ? (
                      <span className="font-mono text-[10px] text-faint">{e.abbreviation}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{t(e.summary)}</p>
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
            {t(entry.label)}
            {entry.abbreviation ? (
              <span className="ml-2 font-mono text-[11px] text-faint">{entry.abbreviation}</span>
            ) : null}
          </h3>
          <p className="text-xs text-muted">{t(entry.summary)}</p>
        </div>
        {mode === "new" ? (
          <button
            type="button"
            onClick={() => setDocType("")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {t("Choose another type")}
          </button>
        ) : null}
      </div>

      {entry.practiceNote ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {t(entry.practiceNote)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {isAi ? (
            <Card>
              <CardHeader
                title={t("Describe it")}
                subtitle={t("A sentence or two is enough. The AI uses the particulars below as well.")}
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>{t("Kind of document")}</label>
                    <select
                      value={aiKind}
                      onChange={(e) => setAiKind(e.target.value as AiDraftKind)}
                      className={input}
                    >
                      {AI_DRAFT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(AI_DRAFT_KIND_LABEL[k])}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{t("Language of the document")}</label>
                    <select
                      value={draftLanguage}
                      onChange={(e) => setAiLanguage(e.target.value as AiDraftLanguage)}
                      className={input}
                    >
                      {AI_DRAFT_LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {t(AI_DRAFT_LANGUAGE_LABEL[l])}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset>
                  <legend className={label}>{t("Style")}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {AI_DRAFT_STYLES.map((s) => (
                      <label
                        key={s}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                          aiStyle === s ? "border-brand bg-brand/5" : "border-border hover:bg-surface-2"
                        }`}
                      >
                        <input
                          type="radio"
                          name="ai-style"
                          value={s}
                          checked={aiStyle === s}
                          onChange={() => setAiStyle(s)}
                          className="sr-only"
                        />
                        <span className="block text-sm font-medium text-fg">{t(AI_DRAFT_STYLE_LABEL[s])}</span>
                        <span className="block text-[11px] text-muted">{t(AI_DRAFT_STYLE_BLURB[s])}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label className={label} htmlFor="ai-summary">
                    {t("What should it say?")}
                  </label>
                  <textarea
                    id="ai-summary"
                    rows={5}
                    maxLength={SUMMARY_MAX}
                    value={aiSummary}
                    onChange={(e) => setAiSummary(e.target.value)}
                    placeholder={t(
                      "e.g. Tell the contractor the roof slab pour is postponed until the engineer approves the revised rebar drawings, and ask for a new date within five working days.",
                    )}
                    className={field}
                  />
                  <p className="mt-1 text-right text-[11px] tabular-nums text-faint">
                    {aiSummary.length} / {SUMMARY_MAX}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={writeWithAi}
                    disabled={aiBusy || pending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
                  >
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiBusy
                      ? t("Writing…")
                      : bodyOverride === null
                        ? t("Write it with AI")
                        : t("Write it again")}
                  </button>
                  <span className="text-xs text-muted" aria-live="polite">
                    {aiBusy
                      ? t("This usually takes ten to thirty seconds.")
                      : bodyOverride !== null
                        ? t("Writing it again replaces the wording, including your edits.")
                        : null}
                  </span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={t("Who and what")}
              subtitle={
                isAi
                  ? t("The AI writes with these; the sheet prints the addressee, date and reference.")
                  : t("Filled into the letter as you type.")
              }
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <ClientSelect
                clients={clients}
                value={clientId}
                onChange={setClientId}
                allowEmpty
                placeholder={t("— none —")}
                labelClassName={label}
                onCreated={(c) => setClients((list) => [...list, c])}
              />
              <ProjectSelect
                projects={projects}
                value={projectId}
                onChange={setProjectId}
                allowEmpty
                placeholder={t("— none —")}
                labelClassName={label}
                onCreated={(p) => {
                  setProjects((list) => [...list, { id: p.id, name: p.projectName }]);
                  // A new project names its client; pick it too when it is on file.
                  const owner = clients.find((c) => c.name === p.client);
                  if (owner && !clientId) setClientId(owner.id);
                }}
              />
              {entry.counterpartyLabel ? (
                <>
                  <div>
                    <label className={label}>{t(entry.counterpartyLabel)}</label>
                    <input
                      value={counterpartyName}
                      onChange={(e) => setCounterpartyName(e.target.value)}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{t("Their address")}</label>
                    <input
                      value={counterpartyAddress}
                      onChange={(e) => setCounterpartyAddress(e.target.value)}
                      className={input}
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label className={label}>{t("Addressed to (name)")}</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>{t("Their email")}</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>{t("Our reference")}</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={`${input} font-mono`}
                />
              </div>
              <div>
                <label className={label}>{t("Subject")}</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>{t("Date of the document")}</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>{t("Effective from")}</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>{t("Until")}</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={input}
                />
              </div>
            </CardBody>
          </Card>

          {entry.fields.length > 0 ? (
          <Card>
            <CardHeader
              title={t("The particulars")}
              subtitle={fmt(t("What this {type} needs to say."), { type: t(entry.label).toLowerCase() })}
            />
            <CardBody className="space-y-4">
              {entry.fields.map((f) => (
                <div key={f.key}>
                  <label className={label}>
                    {t(f.label)}
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
                      <option value="">{t("— choose —")}</option>
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
                  {f.help ? <p className="mt-1 text-[11px] text-faint">{t(f.help)}</p> : null}
                </div>
              ))}
            </CardBody>
          </Card>
          ) : null}

          <Card>
            <CardHeader title={t("Internal notes")} subtitle={t("Never printed on the document.")} />
            <CardBody>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
            </CardBody>
          </Card>
        </div>

        {/* The document as it will read */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader
              title={t("The document")}
              subtitle={
                isAi
                  ? bodyOverride === null
                    ? t("Describe it on the left and click Write it with AI.")
                    : t("Written by AI. Read every line and edit anything here.")
                  : bodyOverride === null
                    ? t("Written from the template as you fill the fields.")
                    : t("You are editing the wording — the fields no longer rewrite it.")
              }
              action={
                isAi ? null : bodyOverride === null ? (
                  <button
                    type="button"
                    onClick={() => setBodyOverride(paragraphs.join("\n\n"))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {t("Edit the wording")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBodyOverride(null)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                    title={t("Go back to the template wording — your edits are discarded")}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> {t("Back to the template")}
                  </button>
                )
              }
            />
            <CardBody className="space-y-3">
              <div>
                <label className={label}>{t("Title")}</label>
                <input
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  placeholder={composed?.title || t(entry.label)}
                  className={input}
                />
              </div>

              {bodyOverride === null ? (
                <A4Sheet label={t("A4 · 210 × 297 mm")}>
                  <div className="space-y-2">
                  {aiBusy ? (
                    <p className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t("Writing…")}
                    </p>
                  ) : paragraphs.length === 0 ? (
                    <p className="text-gray-500">
                      {isAi
                        ? t("The document appears here once the AI has written it.")
                        : t("Fill the particulars and the letter appears here.")}
                    </p>
                  ) : (
                    paragraphs.map((p, i) => <p key={i}>{p}</p>)
                  )}
                  </div>
                </A4Sheet>
              ) : (
                <textarea
                  rows={18}
                  value={bodyOverride}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  className={`${field} font-serif leading-relaxed`}
                  placeholder={t("One paragraph per block, separated by a blank line.")}
                />
              )}

              {isAi && bodyOverride !== null && bodyOverride.includes("_____") ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-fg">
                  <p className="font-medium">
                    {aiMissing.length > 0
                      ? t("Fill in the blanks (__________) before you issue it. The AI was not told:")
                      : t("Fill in the blanks (__________) before you issue it.")}
                  </p>
                  {aiMissing.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                      {aiMissing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {composed && composed.missing.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  {fmt(t("Still needed before this can be issued: {fields}."), {
                    fields: composed.missing.map((f) => t(f.label)).join(", "),
                  })}
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
              {pending ? t("Saving…") : mode === "edit" ? t("Save draft") : t("Create draft")}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
            >
              {t("Cancel")}
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{t(error)}</p> : null}
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
  const t = useT();
  return (
    <p className="text-xs text-faint">
      {t(
        "Templates are a starting point. A power of attorney, an NDA or a notice of termination has legal effect — have your lawyer read the wording once before you rely on it.",
      )}
    </p>
  );
}
