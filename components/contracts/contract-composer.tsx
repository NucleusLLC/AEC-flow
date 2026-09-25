"use client";

/**
 * Making a contract: the particulars, the pre-flight check, and the wait.
 *
 * ─── THE CHECK RUNS BEFORE A TOKEN IS SPENT ─────────────────────────────────
 * Generating costs real money and up to a minute and a half, and the failure it
 * guards against is not an error — it is a contract that comes back looking
 * finished with the completion date blank. So the checklist runs first, shows
 * what it read, and separates what BLOCKS from what merely prints as a blank
 * line. `lib/contracts/preflight.ts` owns those rules; this only draws them.
 *
 * ─── THE PROGRESS IS THE SERVER'S, NOT AN ANIMATION ─────────────────────────
 * Every number on the bar arrives over SSE from work that actually happened —
 * the template read, the characters received, the sections present in the
 * partial JSON. Nothing here invents motion, and the bar never goes backwards.
 * A bar that fills while a request hangs is a lie the user finds out about.
 *
 * ─── NO POPUP ───────────────────────────────────────────────────────────────
 * The SP&CA build had to open its window inside the click, because a popup
 * opened after a long await is blocked. This navigates to the contract instead,
 * so the trap does not exist here.
 */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currencyOptions } from "@/lib/format";
import {
  canGenerate,
  preflight,
  preflightSummary,
  type CheckGroup,
} from "@/lib/contracts/preflight";
import { buildSchedule, totalPercent } from "@/lib/contracts/schedule";
import { EMPTY_FACTS, type ContractFacts, type PhaseInput } from "@/lib/contracts/types";
import type { TemplateDTO } from "@/lib/data/contracts";
import {
  registerTemplateAction,
  templateUploadTicketAction,
} from "@/app/(app)/documents/contracts/actions";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export type ProjectOption = { id: string; projectNumber: string; name: string; siteAddress: string | null };

type Phase = PhaseInput & { key: string };

let seq = 0;
const nextKey = () => `phase-${++seq}`;

export function ContractComposer({
  projects,
  templates,
  people,
  practiceName,
  hasAiKey,
  hasLogo,
  defaultCurrency,
}: {
  projects: ProjectOption[];
  templates: TemplateDTO[];
  people: { id: string; name: string }[];
  practiceName: string;
  hasAiKey: boolean;
  hasLogo: boolean;
  defaultCurrency: string;
}) {
  const router = useRouter();

  const [templateList, setTemplateList] = useState(templates);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [facts, setFacts] = useState<ContractFacts>({
    ...EMPTY_FACTS,
    currency: defaultCurrency,
    administratorName: practiceName,
  });
  const [phases, setPhases] = useState<Phase[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [groups, setGroups] = useState<CheckGroup[] | null>(null);
  const [revealed, setRevealed] = useState(0);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const withPhases: ContractFacts = useMemo(
    () => ({ ...facts, phases: phases.map(({ key: _key, ...p }) => p) }),
    [facts, phases],
  );

  const template = templateList.find((t) => t.id === templateId) ?? null;
  const schedule = useMemo(
    () =>
      buildSchedule({
        contractSum: withPhases.contractSum,
        currency: withPhases.currency,
        exchangeRate: withPhases.exchangeRate,
        phases: withPhases.phases,
      }),
    [withPhases],
  );

  const set = <K extends keyof ContractFacts>(key: K, value: ContractFacts[K]) =>
    setFacts((f) => ({ ...f, [key]: value }));

  const money = (n: number) =>
    `${withPhases.currency} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* ---------------- template upload ---------------- */

  async function uploadTemplate(file: File) {
    setError(null);
    setUploading(true);
    try {
      const ticket = await templateUploadTicketAction({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        sizeBytes: file.size,
      });
      if (!ticket.ok) throw new Error(ticket.error);

      // Straight to storage: the bytes never pass through a server action,
      // which has a 4.5 MB body limit a contract PDF can exceed.
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: ticket.headers,
        body: file,
      });
      if (!put.ok) throw new Error(`The upload did not finish (${put.status}).`);

      const saved = await registerTemplateAction({
        name: file.name.replace(/\.pdf$/i, ""),
        storageKey: ticket.storageKey,
        filename: file.name,
      });
      if (!saved.ok) throw new Error(saved.error);

      setTemplateList((prev) => [saved.template, ...prev]);
      setTemplateId(saved.template.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The template could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ---------------- pre-flight ---------------- */

  async function runCheck() {
    setError(null);
    const result = preflight({
      facts: withPhases,
      hasTemplate: Boolean(templateId),
      templateName: template?.name ?? "",
      hasAiKey,
      hasLogo,
    });
    setGroups(result);
    setChecking(true);
    setRevealed(0);

    // One line at a time, so a person can actually read what was checked.
    const total = result.reduce((n, g) => n + g.items.length, 0);
    for (let i = 1; i <= total; i++) {
      await new Promise((r) => setTimeout(r, 55));
      setRevealed(i);
    }
    setChecking(false);
  }

  /* ---------------- generate ---------------- */

  async function generate() {
    setRunning(true);
    setError(null);
    setProgress(0.02);
    setStage("Starting");
    setSections([]);

    try {
      const response = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: withPhases, templateId }),
      });
      if (!response.ok || !response.body) {
        const message = await response.json().catch(() => null);
        throw new Error(message?.error ?? `The request failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const payload = frame.replace(/^data:\s*/, "").trim();
          if (!payload) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(payload) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof data.error === "string") throw new Error(data.error);
          if (data.done === true && typeof data.id === "string") {
            setProgress(1);
            setStage("Ready");
            router.push(`/documents/contracts/${data.id}`);
            return;
          }
          if (typeof data.progress === "number") setProgress(data.progress);
          if (typeof data.stage === "string") setStage(data.stage);
          if (typeof data.note === "string") setNote(data.note);
          if (Array.isArray(data.sections)) setSections(data.sections as string[]);
        }
      }
      throw new Error("The connection closed before the contract was finished.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The contract could not be generated.");
      setRunning(false);
    }
  }

  const ready = groups !== null && canGenerate(groups) && !checking;

  /* ---------------- the waiting screen ---------------- */

  if (running) {
    return (
      <Card>
        <CardHeader title="Writing the contract" subtitle={note || template?.name || ""} />
        <CardBody className="space-y-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-fg">{stage}</span>
              <span className="font-mono tabular-nums text-muted">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", error ? "bg-red-600" : "bg-brand")}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>

          {sections.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {sections.map((s, i) => (
                <li key={`${s}-${i}`} className="flex items-center gap-2 text-muted">
                  {i === sections.length - 1 ? (
                    <span className="text-brand">✎</span>
                  ) : (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  )}
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              The model is reading your contract. Nothing is written until it has.
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

  /* ---------------- the form ---------------- */

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="The contract to fill in"
          subtitle="Your own contract, as a PDF. The model keeps its wording and changes only the facts."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <span className={label}>Template</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={input}>
              <option value="">— choose —</option>
              {templateList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadTemplate(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-fg hover:bg-surface-2 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload a contract"}
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The job" />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className={label}>Project</span>
            <select
              value={facts.projectId ?? ""}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                setFacts((f) => ({
                  ...f,
                  projectId: p?.id ?? null,
                  projectName: p?.name ?? "",
                  projectNumber: p?.projectNumber ?? "",
                  siteAddress: p?.siteAddress ?? f.siteAddress,
                }));
              }}
              className={input}
            >
              <option value="">No project — type the name</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectNumber} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <Text label="Project name" value={facts.projectName} onChange={(v) => set("projectName", v)} />
          <Text label="Site address" value={facts.siteAddress} onChange={(v) => set("siteAddress", v)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <span className={label}>Scope of works, in a sentence</span>
            <textarea
              value={facts.scopeSummary}
              onChange={(e) => set("scopeSummary", e.target.value)}
              rows={2}
              className={field}
              placeholder="Construction of a two-storey residence including pool and site works"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Parties" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Text label="Employer / client" value={facts.employerName} onChange={(v) => set("employerName", v)} />
          <Text label="Contractor" value={facts.contractorName} onChange={(v) => set("contractorName", v)} />
          <Text label="Employer address" value={facts.employerAddress} onChange={(v) => set("employerAddress", v)} />
          <Text label="Contractor address" value={facts.contractorAddress} onChange={(v) => set("contractorAddress", v)} />
          <Text label="Employer email" value={facts.employerEmail} onChange={(v) => set("employerEmail", v)} />
          <Text label="Contractor email" value={facts.contractorEmail} onChange={(v) => set("contractorEmail", v)} />
          <Text label="Employer telephone" value={facts.employerPhone} onChange={(v) => set("employerPhone", v)} />
          <Text label="Contractor telephone" value={facts.contractorPhone} onChange={(v) => set("contractorPhone", v)} />
          <div>
            <span className={label}>Contract administrator</span>
            <select
              value={facts.administratorName}
              onChange={(e) => set("administratorName", e.target.value)}
              className={input}
            >
              <option value={practiceName}>{practiceName}</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Price, time and payment" />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className={label}>Contract sum</span>
              <input
                value={facts.contractSum ? String(facts.contractSum) : ""}
                onChange={(e) => set("contractSum", Number(e.target.value.replace(/[\s,]/g, "")) || 0)}
                inputMode="decimal"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
            <div>
              <span className={label}>Currency</span>
              <select value={facts.currency} onChange={(e) => set("currency", e.target.value)} className={input}>
                {currencyOptions(["AWG", "USD", "ANG", "EUR"]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>1 US$ =</span>
              <input
                value={String(facts.exchangeRate)}
                onChange={(e) => set("exchangeRate", Number(e.target.value.replace(",", ".")) || 0)}
                inputMode="decimal"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
            <div>
              <span className={label}>Retention %</span>
              <input
                value={facts.retentionPercent === null ? "" : String(facts.retentionPercent)}
                onChange={(e) =>
                  set("retentionPercent", e.target.value === "" ? null : Number(e.target.value) || null)
                }
                inputMode="decimal"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
            <Date label="Commencement" value={facts.commencementDate} onChange={(v) => set("commencementDate", v)} />
            <Date label="Completion" value={facts.completionDate} onChange={(v) => set("completionDate", v)} />
            <div>
              <span className={label}>Contract period (days)</span>
              <input
                value={facts.contractPeriodDays === null ? "" : String(facts.contractPeriodDays)}
                onChange={(e) =>
                  set("contractPeriodDays", e.target.value === "" ? null : Number(e.target.value) || null)
                }
                inputMode="numeric"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
            <div>
              <span className={label}>Damages per day</span>
              <input
                value={facts.liquidatedDamagesPerDay === null ? "" : String(facts.liquidatedDamagesPerDay)}
                onChange={(e) =>
                  set(
                    "liquidatedDamagesPerDay",
                    e.target.value === "" ? null : Number(e.target.value.replace(/[\s,]/g, "")) || null,
                  )
                }
                inputMode="decimal"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-fg">Payment instalments</span>
              <button
                type="button"
                onClick={() =>
                  setPhases((p) => [
                    ...p,
                    { key: nextKey(), phase: String(p.length + 1), description: "", detail: "", percent: 0 },
                  ])
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:bg-surface-2"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {phases.length === 0 ? (
              <p className="text-sm text-muted">
                None — the contract keeps whatever schedule its template has.
              </p>
            ) : (
              <div className="space-y-2">
                {phases.map((p, i) => (
                  <div key={p.key} className="grid gap-2 sm:grid-cols-[3rem_1fr_1fr_5rem_9rem_2rem]">
                    <input
                      value={p.phase}
                      onChange={(e) => patch(i, { phase: e.target.value })}
                      aria-label="Phase"
                      className={`${input} text-center`}
                    />
                    <input
                      value={p.description}
                      onChange={(e) => patch(i, { description: e.target.value })}
                      placeholder="Deposit on signing"
                      aria-label="Instalment"
                      className={input}
                    />
                    <input
                      value={p.detail}
                      onChange={(e) => patch(i, { detail: e.target.value })}
                      placeholder="Within ten days of signing"
                      aria-label="When it falls due"
                      className={input}
                    />
                    <input
                      value={p.percent ? String(p.percent) : ""}
                      onChange={(e) => patch(i, { percent: Number(e.target.value.replace(",", ".")) || 0 })}
                      inputMode="decimal"
                      aria-label="Percent"
                      className={`${input} text-right font-mono tabular-nums`}
                    />
                    <div className="flex h-9 items-center justify-end pr-1 font-mono text-sm tabular-nums text-muted">
                      {money(schedule.rows[i]?.amountAwg ?? 0)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhases((list) => list.filter((x) => x.key !== p.key))}
                      aria-label={`Remove instalment ${p.phase}`}
                      className="grid h-9 place-items-center text-faint hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className={cn("tabular-nums", Math.abs(totalPercent(withPhases.phases) - 100) < 0.005 ? "text-muted" : "text-amber-600")}>
                    {totalPercent(withPhases.phases)}% of the contract sum
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-fg">
                    {money(schedule.totals.amountAwg)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <span className={label}>Anything else the contract should say</span>
            <textarea
              value={facts.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={field}
              placeholder="Free text — passed to the model with the particulars"
            />
          </div>
        </CardBody>
      </Card>

      {groups ? (
        <Card>
          <CardHeader
            title={checking ? "Checking" : "Checked"}
            subtitle={checking ? "Reading what you entered…" : preflightSummary(groups)}
          />
          <CardBody className="space-y-3">
            {groups.map((group) => {
              let index = 0;
              for (const g of groups) {
                if (g === group) break;
                index += g.items.length;
              }
              return (
                <div key={group.label}>
                  <div className="text-[11px] uppercase tracking-wide text-faint">{group.label}</div>
                  <ul className="mt-1 space-y-0.5">
                    {group.items.map((item, i) => {
                      if (index + i >= revealed) return null;
                      return (
                        <li key={item.label} className="flex items-baseline gap-2 text-sm">
                          {item.ok ? (
                            <Check className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-green-600" />
                          ) : item.required ? (
                            <X className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-red-600" />
                          ) : (
                            <CircleAlert className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-amber-600" />
                          )}
                          <span className={item.ok ? "text-muted" : item.required ? "text-fg" : "text-muted"}>
                            {item.label}
                          </span>
                          {item.detail ? (
                            <span className="truncate text-[11px] text-faint">{item.detail}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={checking}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-60"
        >
          <FileText className="h-4 w-4" /> {groups ? "Check again" : "Check the particulars"}
        </button>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={!ready}
          title={ready ? undefined : "Run the check first, and clear anything it marks in red."}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          Create the contract
        </button>
      </div>
    </div>
  );

  function patch(index: number, changes: Partial<PhaseInput>) {
    setPhases((list) => list.map((p, i) => (i === index ? { ...p, ...changes } : p)));
  }
}

function Text({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className={label}>{text}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    </div>
  );
}

function Date({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className={label}>{text}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    </div>
  );
}
