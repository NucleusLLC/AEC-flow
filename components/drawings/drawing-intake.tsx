"use client";

/**
 * Drawing intake — drop files, see what the extractor proposes, correct it,
 * confirm.
 *
 * THE DESIGN RULE THIS COMPONENT EXISTS TO ENFORCE: extraction PROPOSES, the
 * user CONFIRMS. Nothing is saved from a machine reading alone. The reasoning
 * is in docs/drawings-intake/01-FEASIBILITY.md §4, and the short version is
 * that a drawing register with a wrong sheet number is worse than one with a
 * blank sheet number — a blank gets chased, a wrong one gets built from.
 *
 * ACCESSIBILITY. The drop zone is a convenience, not the interface. A real,
 * visible, focusable `<input type="file">` sits inside it and does the same
 * job; every proposed field is a labelled form control; the results summary is
 * an `aria-live` region so a screen-reader user learns what was found without
 * hunting for it. A drop zone that only works with a mouse would not be
 * finished, and neither would one whose results are only visible.
 *
 * PERSISTENCE IS NOT WIRED. The component depends on `DrawingIntakeRepository`
 * (types only, `lib/drawings/persistence.ts`) and nothing else. Passing a real
 * implementation is the whole of the next step; without one the confirm button
 * says so rather than pretending.
 */

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FileStack, FileWarning, Info, Trash2, UploadCloud } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTRIBUTE,
  EXTRACTION_ENGINE_VERSION,
  MAX_FILES_PER_BATCH,
  SHEET_DISCIPLINE_LABEL,
  extractDrawingMetadata,
  formatBytes,
  validateBatch,
  type ConfirmedDrawingMetadata,
  type DraftFieldKey,
  type DrawingExtractionAudit,
  type DrawingFileKind,
  type DrawingIntakeRepository,
  type DrawingMetadataDraft,
  type Field,
  type SheetDiscipline,
  toDataDiscipline,
} from "@/lib/drawings";

/* ------------------------------------------------------------------ *
 * Editable shape
 * ------------------------------------------------------------------ */

type EditableValues = {
  sheetNumber: string;
  title: string;
  discipline: SheetDiscipline | "";
  projectNumber: string;
  projectName: string;
  revision: string;
  issueDate: string;
};

type IntakeItem = {
  id: string;
  file: File;
  kind: DrawingFileKind;
  draft: DrawingMetadataDraft;
  values: EditableValues;
  edited: DraftFieldKey[];
};

export type DrawingIntakeResult = {
  file: File;
  metadata: ConfirmedDrawingMetadata;
  projectNumber: string;
  projectName: string;
  audit: DrawingExtractionAudit;
};

export type DrawingIntakeProps = {
  /** Project the drop is scoped to. Used for the eventual storage key. */
  projectId?: string;
  /**
   * Implementation of the persistence seam. Omit and the component renders a
   * truthful "not connected yet" state instead of a dead save button.
   */
  repository?: DrawingIntakeRepository;
  /** Called with the confirmed rows. Fires whether or not a repository exists,
   *  so a parent can drive its own optimistic list today. */
  onConfirm?: (results: DrawingIntakeResult[]) => void;
};

function initialValues(draft: DrawingMetadataDraft): EditableValues {
  return {
    sheetNumber: draft.sheetNumber?.value ?? "",
    title: draft.title?.value ?? "",
    discipline: draft.discipline?.value ?? "",
    projectNumber: draft.projectNumber?.value ?? "",
    projectName: draft.projectName?.value ?? "",
    revision: draft.revision?.value ?? "",
    issueDate: draft.issueDate?.value ?? "",
  };
}

/* ------------------------------------------------------------------ *
 * Confidence chip
 * ------------------------------------------------------------------ */

function ConfidenceChip({
  field,
  edited,
}: {
  field: Field<string> | Field<SheetDiscipline> | null;
  edited: boolean;
}) {
  if (edited) return <Badge tone="blue">edited</Badge>;
  if (!field) return <Badge tone="slate">not found</Badge>;
  const tone = field.band === "high" ? "green" : field.band === "medium" ? "amber" : "slate";
  return (
    <Badge tone={tone}>
      {field.band} · {Math.round(field.confidence * 100)}%
    </Badge>
  );
}

function EvidenceLine({ field }: { field: Field<string> | Field<SheetDiscipline> | null }) {
  if (!field || field.evidence.length === 0) return null;
  const e = field.evidence[0];
  const extra = field.alternates.length > 0 ? ` · also saw ${field.alternates.map((a) => String(a.value)).join(", ")}` : "";
  return (
    <p className="mt-1 text-[11px] leading-snug text-faint">
      from <span className="font-mono">“{e.fragment}”</span>
      {e.note ? ` — ${e.note}` : ""}
      {extra}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * One proposed row
 * ------------------------------------------------------------------ */

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function ProposalRow({
  item,
  onChange,
  onRemove,
}: {
  item: IntakeItem;
  onChange: (id: string, key: DraftFieldKey, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const uid = useId();
  const isEdited = (k: DraftFieldKey) => item.edited.includes(k);

  const textField = (
    key: Exclude<DraftFieldKey, "discipline">,
    label: string,
    placeholder: string,
    type: "text" | "date" = "text",
  ) => (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`${uid}-${key}`} className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {label}
        </label>
        <ConfidenceChip field={item.draft[key]} edited={isEdited(key)} />
      </div>
      <input
        id={`${uid}-${key}`}
        type={type}
        value={item.values[key]}
        placeholder={placeholder}
        onChange={(e) => onChange(item.id, key, e.target.value)}
        className={cn(inputClass, "mt-1")}
      />
      <EvidenceLine field={item.draft[key]} />
    </div>
  );

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <FileStack className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{item.file.name}</p>
            <p className="text-[11px] text-faint">
              {item.kind} · {formatBytes(item.file.size)}
              {item.kind !== "PDF" ? " · filename only — the content cannot be read" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.file.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {textField("sheetNumber", "Sheet number", "A-101")}
        {textField("title", "Sheet title", "Ground Floor Plan")}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${uid}-discipline`}
              className="text-[11px] font-medium uppercase tracking-wide text-faint"
            >
              Discipline
            </label>
            <ConfidenceChip field={item.draft.discipline} edited={isEdited("discipline")} />
          </div>
          <select
            id={`${uid}-discipline`}
            value={item.values.discipline}
            onChange={(e) => onChange(item.id, "discipline", e.target.value)}
            className={cn(inputClass, "mt-1")}
          >
            <option value="">— not set —</option>
            {(Object.keys(SHEET_DISCIPLINE_LABEL) as SheetDiscipline[]).map((d) => (
              <option key={d} value={d}>
                {SHEET_DISCIPLINE_LABEL[d]}
              </option>
            ))}
          </select>
          <EvidenceLine field={item.draft.discipline} />
        </div>
        {textField("projectNumber", "Project number", "ZA-2026-121")}
        {textField("projectName", "Project name", "Marina Heights Tower")}
        {textField("revision", "Revision", "B")}
        {textField("issueDate", "Issue date", "", "date")}
      </div>

      {item.draft.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {item.draft.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-[11px] leading-snug text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The intake surface
 * ------------------------------------------------------------------ */

export function DrawingIntake({ projectId, repository, onConfirm }: DrawingIntakeProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [rejections, setRejections] = useState<Array<{ name: string; message: string }>>([]);
  const [announcement, setAnnouncement] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const accept = useCallback((fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    const { batchError, verdicts } = validateBatch(
      files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    );

    if (batchError) {
      setRejections([{ name: `${files.length} files`, message: batchError }]);
      setAnnouncement(batchError);
      return;
    }

    const accepted: IntakeItem[] = [];
    const refused: Array<{ name: string; message: string }> = [];

    files.forEach((file, i) => {
      const verdict = verdicts[i];
      if (!verdict?.ok) {
        refused.push({ name: file.name, message: verdict?.message ?? "Rejected." });
        return;
      }
      // Filename-only extraction. Reading the PDF's title block needs a
      // server-side reader (lib/drawings/pdf-text.ts) that is not wired yet;
      // when it is, the draft is re-merged and the same form re-renders.
      const draft = extractDrawingMetadata({ filename: file.name });
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${i}`,
        file,
        kind: verdict.kind,
        draft,
        values: initialValues(draft),
        edited: [],
      });
    });

    setItems((prev) => [...prev, ...accepted]);
    setRejections(refused);

    const found = accepted.filter((a) => a.draft.sheetNumber).length;
    setAnnouncement(
      [
        `${accepted.length} of ${files.length} file${files.length === 1 ? "" : "s"} accepted.`,
        accepted.length > 0 ? `Sheet number proposed for ${found} of ${accepted.length}.` : "",
        refused.length > 0 ? `${refused.length} rejected: ${refused.map((r) => r.message).join(" ")}` : "",
        accepted.length > 0 ? "Check every proposed value before confirming." : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      accept(e.dataTransfer?.files ?? null);
    },
    [accept],
  );

  const onChange = useCallback((id: string, key: DraftFieldKey, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const proposed = item.draft[key]?.value ?? "";
        const edited = value !== proposed;
        return {
          ...item,
          values: { ...item.values, [key]: value },
          edited: edited
            ? [...new Set([...item.edited, key])]
            : item.edited.filter((k) => k !== key),
        };
      }),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const incomplete = useMemo(
    () => items.filter((i) => !i.values.sheetNumber.trim()).map((i) => i.file.name),
    [items],
  );

  const confirm = useCallback(async () => {
    if (items.length === 0 || incomplete.length > 0) return;

    const results: DrawingIntakeResult[] = items.map((item) => ({
      file: item.file,
      projectNumber: item.values.projectNumber.trim(),
      projectName: item.values.projectName.trim(),
      metadata: {
        sheetNumber: item.values.sheetNumber.trim(),
        title: item.values.title.trim(),
        discipline: toDataDiscipline(item.values.discipline || "ARCHITECTURAL"),
        revision: item.values.revision.trim(),
        issueDate: item.values.issueDate,
        status: "DRAFT",
      },
      audit: {
        engineVersion: EXTRACTION_ENGINE_VERSION,
        inputs: { filename: true, titleBlockText: false },
        proposed: item.draft,
        editedFields: item.edited,
      },
    }));

    onConfirm?.(results);

    if (!repository) {
      setSaveState("error");
      setSaveMessage(
        "Storage is not connected yet, so nothing was saved. The confirmed values were handed to the page instead.",
      );
      setAnnouncement("Storage is not connected yet — nothing was saved.");
      return;
    }

    setSaveState("saving");
    setSaveMessage("");
    try {
      for (const r of results) {
        const ticket = await repository.createUploadTicket({
          projectId: projectId ?? r.projectNumber,
          filename: r.file.name,
          mimeType: r.file.type || "application/octet-stream",
          sizeBytes: r.file.size,
        });
        // The bytes go straight to storage; see persistence.ts for why.
        await fetch(ticket.uploadUrl, {
          method: "PUT",
          headers: ticket.headers,
          body: r.file,
        });
        await repository.registerDrawing({
          projectId: projectId ?? r.projectNumber,
          file: {
            storageKey: ticket.storageKey,
            filename: r.file.name,
            mimeType: r.file.type || "application/octet-stream",
            sizeBytes: r.file.size,
            fileType: r.file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DWG",
          },
          metadata: r.metadata,
          audit: r.audit,
        });
      }
      setItems([]);
      setSaveState("idle");
      setAnnouncement(`${results.length} drawing${results.length === 1 ? "" : "s"} saved.`);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Saving failed.";
      setSaveMessage(message);
      setAnnouncement(`Saving failed. ${message}`);
    }
  }, [items, incomplete, onConfirm, repository, projectId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Add drawings"
          subtitle="Drop files or browse. Every value below is a proposal — check it before confirming."
        />
        <CardBody>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-brand bg-brand/5" : "border-border bg-surface-2",
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">Drop drawing files here</p>
              <p className="mt-0.5 text-xs text-muted">
                PDF, DWG, DXF or RVT · up to {MAX_FILES_PER_BATCH} files · 100 MB each
              </p>
            </div>

            {/* The real control. Focusable, labelled, and does everything the
                drop zone does — the drop zone is the shortcut, not the door. */}
            <div className="flex flex-col items-center gap-1.5">
              <label htmlFor={inputId} className="text-xs font-medium text-fg">
                Or choose files
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                onChange={(e) => {
                  accept(e.target.files);
                  e.target.value = "";
                }}
                className={cn(
                  "block w-full max-w-xs cursor-pointer rounded-lg border border-border bg-surface text-xs text-muted",
                  "file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-fg",
                  "focus:outline-none focus:ring-2 focus:ring-brand/40 focus-visible:ring-2 focus-visible:ring-brand/40",
                )}
              />
            </div>
          </div>

          {/* Results are announced, not just displayed. */}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>

          {rejections.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {rejections.map((r) => (
                <li
                  key={`${r.name}-${r.message}`}
                  className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted"
                >
                  <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{r.name}</span> — {r.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      {items.length > 0 ? (
        <Card>
          <CardHeader
            title={`Confirm ${items.length} drawing${items.length === 1 ? "" : "s"}`}
            subtitle="Extraction proposes; you confirm. A wrong sheet number is worse than a blank one."
          />
          <CardBody className="space-y-4">
            {items.map((item) => (
              <ProposalRow key={item.id} item={item} onChange={onChange} onRemove={removeItem} />
            ))}

            {incomplete.length > 0 ? (
              <p className="text-xs text-muted">
                A sheet number is required before saving. Missing on: {incomplete.join(", ")}.
              </p>
            ) : null}

            {saveState === "error" && saveMessage ? (
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">{saveMessage}</p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-faint">
                {repository
                  ? "Files upload directly to storage; the register row is written afterwards."
                  : "Storage is not connected yet — confirming hands the values to this page without saving."}
              </p>
              <button
                type="button"
                onClick={confirm}
                disabled={items.length === 0 || incomplete.length > 0 || saveState === "saving"}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                  "bg-brand text-brand-fg hover:opacity-90",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {saveState === "saving" ? "Saving…" : `Confirm ${items.length}`}
              </button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
