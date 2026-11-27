"use client";

/**
 * Import from MEPflow — pick a cadgen.boq/1 file, choose where it goes, check
 * the lines and their prices, then create a draft cost estimate (one section
 * per category) or a draft purchase order.
 *
 * The file is read and previewed in the browser with the same pure module the
 * server action uses (lib/imports/cadgen-boq.ts); the action reads the price
 * book itself and re-checks every field. Images are shrunk here so the request
 * stays far under the 4 MB server-action limit.
 */
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileJson, ImageIcon, Upload } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import {
  BOQ_LIMITS,
  buildPreview,
  importTitle,
  parseBoqFile,
  type BoqFile,
  type BoqPrice,
  type PriceMatch,
} from "@/lib/imports/cadgen-boq";
import { importBoqAction, type BoqImportInput, type BoqImportResult } from "@/app/(app)/estimates/import/actions";
import type { ImportTargetClient, ImportTargetProject } from "@/lib/data/boq-import.types";

type ProjectMode = "existing" | "new" | "none";

const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1 block text-xs font-medium text-muted";

/** Shrink a raster data URL to at most `max` px on its long side, as JPEG. */
function shrinkToJpeg(dataUrl: string, max = 1600, quality = 0.85): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Floor plan: an SVG stays vector when small enough; anything else becomes a PNG-free JPEG. */
async function preparePlan(dataUrl: string, mime: string): Promise<string | null> {
  const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (mime === "image/svg+xml" && approxBytes <= BOQ_LIMITS.maxPlanBytes) return dataUrl;
  return shrinkToJpeg(dataUrl, 2000, 0.9);
}

const norm = (s: string) => s.trim().toLowerCase();

export function BoqImport({
  projects,
  clients,
  priceBook,
  currencies,
  defaultCurrency,
}: {
  projects: ImportTargetProject[];
  clients: ImportTargetClient[];
  priceBook: BoqPrice[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<BoqFile | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [rendering, setRendering] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const [target, setTarget] = useState<"estimate" | "purchase-order">("estimate");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [mode, setMode] = useState<ProjectMode>("existing");
  const [projectId, setProjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [projectCover, setProjectCover] = useState(true);

  const [result, setResult] = useState<BoqImportResult | null>(null);
  const [pending, start] = useTransition();

  const preview = useMemo(() => (file ? buildPreview(file, priceBook, currency) : null), [file, priceBook, currency]);
  const nf = useMemo(() => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);

  async function onPick(f: File | undefined) {
    setResult(null);
    setReadError(null);
    setFile(null);
    setRendering(null);
    setPlan(null);
    if (!f) return;
    setFileName(f.name);
    if (f.size > BOQ_LIMITS.maxFileBytes) {
      setReadError(t("The file is larger than 15 MB."));
      return;
    }
    const parsed = parseBoqFile(await f.text());
    if (!parsed.ok) {
      setReadError(parsed.message);
      return;
    }
    const b = parsed.file;
    setFile(b);
    setTarget(b.purpose);
    // Pick the project the file names, by number first, then by name.
    const hit =
      projects.find((p) => b.project.number && norm(p.number) === norm(b.project.number)) ??
      projects.find((p) => b.project.name && norm(p.name) === norm(b.project.name));
    if (hit) {
      setMode("existing");
      setProjectId(hit.id);
    } else {
      setMode(b.project.name ? "new" : "existing");
      setProjectId("");
    }
    setNewName(b.project.name);
    setNewNumber(b.project.number);
    setNewAddress(b.project.address);
    setNewClientId(clients.find((c) => b.project.owner && norm(c.name) === norm(b.project.owner))?.id ?? "");
    if (b.rendering) setRendering(await shrinkToJpeg(b.rendering.dataUrl));
    if (b.floorPlan) setPlan(await preparePlan(b.floorPlan.dataUrl, b.floorPlan.mime));
  }

  function submit() {
    if (!file) return;
    const { rendering: _r, floorPlan: _f, ...core } = file;
    void _r;
    void _f;
    const project: BoqImportInput["project"] =
      mode === "existing"
        ? { mode, id: projectId }
        : mode === "new"
          ? { mode, name: newName, number: newNumber, clientId: newClientId, siteAddress: newAddress }
          : { mode: "none" };
    start(async () => {
      setResult(
        await importBoqAction({
          core,
          target,
          currency,
          project,
          rendering,
          plan: target === "estimate" ? plan : null,
          projectCover: projectCover && mode !== "none",
        }),
      );
    });
  }

  const ready =
    Boolean(file) &&
    (mode === "existing" ? Boolean(projectId) : mode === "new" ? Boolean(newName.trim() && newClientId) : target === "purchase-order");

  const matchCell = (m: PriceMatch) =>
    m.status === "priced" ? (
      <span className="text-emerald-700 dark:text-emerald-400">{t("Price book")}</span>
    ) : m.status === "other-currency" ? (
      <span className="text-amber-700 dark:text-amber-400" title={`${m.name}: ${m.currency} ${nf.format(m.unitPrice)}`}>
        {fmt(t("Price in {currency}"), { currency: m.currency })}
      </span>
    ) : (
      <span className="text-faint">{t("To price")}</span>
    );

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6" data-testid="boq-import-done">
        <h3 className="text-base font-semibold text-fg">
          {target === "purchase-order" ? t("Purchase order created") : t("Cost estimate created")}
        </h3>
        <p className="mt-1 text-sm text-muted">{result.label}</p>
        {result.notes.includes("cover-set") ? <p className="mt-2 text-sm text-muted">{t("The rendering is now the project cover image.")}</p> : null}
        {result.notes.includes("cover-storage") ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{t("File storage is not connected, so the project cover image was not saved.")}</p>
        ) : null}
        {result.notes.includes("cover-failed") ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{t("The project cover image could not be saved.")}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={result.href} className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90">
            {target === "purchase-order" ? t("Open purchase order") : t("Open estimate")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setFile(null);
              setFileName("");
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t("Import another file")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1 — the file */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-fg">{t("1. Pick the MEPflow file")}</h3>
        <p className="mt-1 text-sm text-muted">
          {t("The AEC-flow cost estimate or purchase order JSON saved from a MEPflow generator (Pool & Jacuzzi: Bill of quantities › AEC-flow).")}
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 text-sm text-fg hover:border-brand">
          <Upload className="h-5 w-5 text-muted" aria-hidden="true" />
          <span>{fileName || t("Choose a .json file")}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            data-testid="boq-file"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
        </label>
        {readError ? (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400" data-testid="boq-read-error">
            {readError}
          </p>
        ) : null}
        {file ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 text-fg">
              <FileJson className="h-4 w-4" aria-hidden="true" />
              {importTitle(file)}
            </span>
            {file.project.number ? <span>{file.project.number}</span> : null}
            {file.project.owner ? <span>{file.project.owner}</span> : null}
            <span>{file.source}</span>
          </div>
        ) : null}
      </section>

      {file && preview ? (
        <>
          {/* 2 — where it goes */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-fg">{t("2. Where it goes")}</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div>
                <span className={label}>{t("Create")}</span>
                <div className="flex gap-2">
                  {(["estimate", "purchase-order"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setTarget(k);
                        if (k === "estimate" && mode === "none") setMode("existing");
                      }}
                      aria-pressed={target === k}
                      className={`h-9 flex-1 rounded-lg border px-3 text-sm font-medium ${target === k ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-fg hover:bg-surface-2"}`}
                    >
                      {k === "estimate" ? t("Cost estimate") : t("Purchase order")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="boq-currency" className={label}>{t("Currency")}</label>
                <select id="boq-currency" className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>{t("Project")}</span>
                <div className="flex gap-2">
                  {(["existing", "new", ...(target === "purchase-order" ? (["none"] as const) : [])] as ProjectMode[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMode(k)}
                      aria-pressed={mode === k}
                      className={`h-9 flex-1 rounded-lg border px-2 text-sm font-medium ${mode === k ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-fg hover:bg-surface-2"}`}
                    >
                      {k === "existing" ? t("Existing") : k === "new" ? t("New from file") : t("None")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mode === "existing" ? (
              <div className="mt-4 max-w-xl">
                <label htmlFor="boq-project" className={label}>{t("Project")}</label>
                <select id="boq-project" className={input} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">{t("Choose a project…")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} · {p.name}
                      {p.client ? ` (${p.client})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === "new" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="boq-new-name" className={label}>{t("Project name")}</label>
                  <input id="boq-new-name" className={input} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <label htmlFor="boq-new-number" className={label}>{t("Project number (blank = automatic)")}</label>
                  <input id="boq-new-number" className={input} value={newNumber} onChange={(e) => setNewNumber(e.target.value)} maxLength={40} />
                </div>
                <div>
                  <label htmlFor="boq-new-client" className={label}>{t("Client")}</label>
                  <select id="boq-new-client" className={input} value={newClientId} onChange={(e) => setNewClientId(e.target.value)}>
                    <option value="">{t("Choose a client…")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {file.project.owner && !newClientId ? (
                    <p className="mt-1 text-xs text-muted">
                      {fmt(t("The file names the owner “{owner}”, who is not a client yet."), { owner: file.project.owner })}{" "}
                      <Link href="/clients/new" className="text-brand hover:underline">{t("Add the client")}</Link>
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="boq-new-address" className={label}>{t("Site address")}</label>
                  <input id="boq-new-address" className={input} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} maxLength={300} />
                </div>
              </div>
            ) : null}
          </section>

          {/* 3 — cover */}
          {rendering || plan ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-semibold text-fg">{t("3. Cover")}</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {rendering ? (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={rendering} alt={t("Rendering")} className="aspect-video w-full rounded-lg border border-border object-cover" />
                    <figcaption className="mt-1 text-xs text-muted">{t("Rendering")}</figcaption>
                  </figure>
                ) : null}
                {plan && target === "estimate" ? (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                    <img src={plan} alt={t("Floor plan")} className="aspect-video w-full rounded-lg border border-border bg-white object-contain" />
                    <figcaption className="mt-1 text-xs text-muted">{t("Floor plan")}</figcaption>
                  </figure>
                ) : null}
              </div>
              <div className="mt-3 space-y-1 text-sm text-fg">
                {rendering && mode !== "none" ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={projectCover} onChange={(e) => setProjectCover(e.target.checked)} />
                    {t("Use the rendering as the project cover image")}
                  </label>
                ) : null}
                {target === "estimate" ? (
                  <p className="flex items-center gap-2 text-muted">
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    {t("The rendering and floor plan go on the estimate’s cover page (cover page switched on).")}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 4 — lines */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">{rendering || plan ? t("4. Lines") : t("3. Lines")}</h3>
              <p className="text-sm text-muted" data-testid="boq-summary">
                {fmt(t("{lines} lines in {sections} sections · {priced} priced from the price book · {open} to price"), {
                  lines: String(preview.lineCount),
                  sections: String(preview.sections.length),
                  priced: String(preview.priced),
                  open: String(preview.unpriced + preview.otherCurrency),
                })}
              </p>
            </div>
            {preview.otherCurrency > 0 ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {fmt(t("{n} lines match a price-book code in another currency; they are left for you to price."), { n: String(preview.otherCurrency) })}
              </p>
            ) : null}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">{t("Code")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Description")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t("Qty")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Unit")}</th>
                    <th className="py-2 pr-3 font-medium">{t("Price")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t("Unit price")}</th>
                    <th className="py-2 text-right font-medium">{t("Amount")}</th>
                  </tr>
                </thead>
                {preview.sections.map((s) => (
                  <tbody key={s.name}>
                    <tr className="zebra-row border-b border-border bg-surface-2">
                      <td colSpan={6} className="py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide text-fg">{s.name}</td>
                      <td className="py-1.5 text-right text-xs font-semibold text-fg">{s.total ? `${currency} ${nf.format(s.total)}` : "—"}</td>
                    </tr>
                    {s.lines.map((l, i) => (
                      <tr key={`${s.name}-${i}`} className="zebra-row border-b border-border/60 align-top">
                        <td className="py-1.5 pr-3 font-mono text-xs text-muted">{l.code || "—"}</td>
                        <td className="py-1.5 pr-3 text-fg">{l.task}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-fg">{l.quantity}</td>
                        <td className="py-1.5 pr-3 text-muted">{l.unit || "—"}</td>
                        <td className="py-1.5 pr-3 text-xs">{matchCell(l.match)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-fg">{l.match.status === "priced" ? nf.format(l.match.unitPrice) : "—"}</td>
                        <td className="py-1.5 text-right tabular-nums text-fg">{l.amount ? nf.format(l.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          {result && !result.ok ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="boq-import-error">
              {result.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!ready || pending}
              onClick={submit}
              data-testid="boq-import-submit"
              className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("Importing…") : target === "purchase-order" ? t("Create purchase order") : t("Create cost estimate")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
