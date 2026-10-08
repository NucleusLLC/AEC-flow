"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  DISCIPLINE_LABEL,
  PROJECT_STATUS_LABEL,
  PRIORITY_LABEL,
  type Discipline,
  type ProjectStatus,
  type Priority,
  type ProjectWriteInput,
} from "@/lib/data/projects.types";
import {
  DEVELOPMENT_ERRORS,
  DEVELOPMENT_OTHER_MAX,
  DEVELOPMENT_TYPES,
  DEVELOPMENT_TYPE_OPTION,
  checkDevelopment,
  type ProjectDevelopmentType,
} from "@/lib/projects/development";
import { saveProject } from "@/app/(app)/projects/actions";
import { getSystemCurrency } from "@/lib/format";
import { ClientSelect } from "@/components/clients/client-select";
import { MemberSelect } from "@/components/team/member-select";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

// DEVELOPMENT panel — the olive "military" look of the Estimates ADD NEW dialog.
const devLabelClass = "mb-1 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#4b5320] dark:text-[#c5d18a]";
const devInputClass =
  "h-9 w-full rounded-md border border-[#5c6633] bg-surface px-3 text-sm font-semibold text-fg outline-none focus:border-[#5c6633] focus:ring-2 focus:ring-[#8a9a5b]/30";

const DISCIPLINES = Object.keys(DISCIPLINE_LABEL) as Discipline[];
const STATUSES = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[];
const PRIORITIES = Object.keys(PRIORITY_LABEL) as Priority[];

/**
 * Prefill shape for edit mode. `clientName`/`manager` are display names (the
 * form submits names; they're resolved to ids server-side). Empty strings /
 * empty arrays render as "unset" for the uncontrolled inputs.
 */
export type ProjectFormValues = {
  name: string;
  projectNumber: string;
  clientName: string;
  manager: string;
  status: ProjectStatus;
  priority: Priority;
  disciplines: Discipline[];
  /** DEVELOPMENT type, or null when the project is not a development. */
  developmentType: ProjectDevelopmentType | null;
  /** The typed type when developmentType is OTHER ("" otherwise). */
  developmentTypeOther: string;
  startDate: string;
  targetEndDate: string;
  value: number;
  siteAddress: string;
  description: string;
  currency: string;
};

export function ProjectForm({
  // Aliased: the live, growable lists live in state below, and shadowing the
  // props with them would make it easy to read the stale one by accident.
  clients: clientNames,
  managers: managerNames,
  mode = "new",
  initial,
  projectId,
  backHref = "/projects",
}: {
  clients: string[];
  managers: string[];
  mode?: "new" | "edit";
  initial?: ProjectFormValues;
  projectId?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Client and manager are the two fields that used to fail on an empty roster:
  // the selects rendered with no options at all, posted "", and the server came
  // back with `Client not found: ""`. They are now creatable pickers, which have
  // to be controlled, so these two values come from state rather than FormData.
  // The rest of the form stays uncontrolled — no reason to churn it.
  const [clients, setClients] = useState<string[]>(clientNames);
  const [managers, setManagers] = useState<string[]>(managerNames);
  const [clientName, setClientName] = useState(initial?.clientName ?? clientNames[0] ?? "");
  const [manager, setManager] = useState(initial?.manager ?? managerNames[0] ?? "");

  // DEVELOPMENT is controlled: the type dropdown appears only while the box is
  // ticked, and the text box only for OTHER. Unticking keeps what was chosen on
  // screen (tick it again and it is still there) but saves "not a development".
  const [devTicked, setDevTicked] = useState(!!initial?.developmentType);
  const [devType, setDevType] = useState<string>(initial?.developmentType ?? "");
  const [devOther, setDevOther] = useState(initial?.developmentTypeOther ?? "");
  const [devError, setDevError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dev = checkDevelopment({ ticked: devTicked, type: devType, other: devOther });
    if (!dev.ok) {
      setDevError(dev.error);
      return;
    }
    setDevError(null);
    const fd = new FormData(e.currentTarget);
    const payload: ProjectWriteInput = {
      name: String(fd.get("name") ?? ""),
      projectNumber: (fd.get("projectNumber") as string) || null,
      clientName,
      manager,
      status: (fd.get("status") as ProjectStatus) || undefined,
      priority: (fd.get("priority") as Priority) || undefined,
      disciplines: fd.getAll("disciplines").map((d) => String(d) as Discipline),
      developmentType: dev.developmentType,
      developmentTypeOther: dev.developmentTypeOther,
      startDate: (fd.get("startDate") as string) || null,
      targetEndDate: (fd.get("targetEndDate") as string) || null,
      value: Number(fd.get("value")) || 0,
      siteAddress: (fd.get("siteAddress") as string) || null,
      description: (fd.get("description") as string) || null,
      currency: (fd.get("currency") as string) || undefined,
    };

    setError(null);
    startTransition(async () => {
      const res =
        mode === "edit"
          ? await saveProject("edit", payload, projectId)
          : await saveProject("new", payload);
      if (res.ok) {
        router.push(`/projects/${res.id}`);
        router.refresh();
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">
              {mode === "edit" ? t("Could not update project.") : t("Could not create project.")}
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <input type="hidden" name="currency" defaultValue={initial?.currency ?? getSystemCurrency()} />
      ) : null}

      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">{t("Project details")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="name">
              {t("Project name *")}
            </label>
            <input id="name" name="name" required className={inputClass} placeholder={t("e.g. Marina Heights Tower — Phase 3")} defaultValue={initial?.name} />
          </div>

          <div>
            <label className={labelClass} htmlFor="projectNumber">
              {t("Project number")}
            </label>
            <input
              id="projectNumber"
              name="projectNumber"
              className={`${inputClass} font-mono`}
              placeholder={mode === "edit" ? "" : t("Automatic (ZA-YYYY-NNN)")}
              defaultValue={initial?.projectNumber}
              required={mode === "edit"}
              maxLength={40}
            />
            <p className="mt-1 text-[11px] text-faint">
              {mode === "edit"
                ? t("Type your own, e.g. 2026A-019. Must be unique.")
                : t("Leave blank for the next automatic number, or type your own, e.g. 2026A-019.")}
            </p>
          </div>

          {/* Both submit display NAMES, which the server resolves — hence
              `by="name"`. See `resolveClientId` / `resolveManagerId`. */}
          <ClientSelect
            id="clientName"
            label={t("Client")}
            by="name"
            clients={clients.map((c) => ({ id: c, name: c }))}
            value={clientName}
            onChange={setClientName}
            onCreated={(c) => setClients((prev) => [...prev, c.name])}
            labelClassName={labelClass}
          />

          <MemberSelect
            id="manager"
            label={t("Project manager")}
            by="name"
            members={managers.map((m) => ({ id: m, name: m }))}
            value={manager}
            onChange={setManager}
            onCreated={(m) => setManagers((prev) => [...prev, m.name])}
            // This list is filtered to MANAGER/DIRECTOR by the server page, so a
            // member added here must be a MANAGER to show up in it again.
            defaultRole="MANAGER"
            allowEmpty
            placeholder={t("Most senior user")}
            hint={t("Left unset, the most senior user is assigned.")}
            labelClassName={labelClass}
          />

          <div>
            <label className={labelClass} htmlFor="status">
              {t("Status")}
            </label>
            <select id="status" name="status" className={inputClass} defaultValue={initial?.status ?? "ACTIVE"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(PROJECT_STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="priority">
              {t("Priority")}
            </label>
            <select id="priority" name="priority" className={inputClass} defaultValue={initial?.priority ?? "MEDIUM"}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(PRIORITY_LABEL[p])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="startDate">
              {t("Start date")}
            </label>
            <input id="startDate" name="startDate" type="date" className={inputClass} defaultValue={initial?.startDate} />
          </div>

          <div>
            <label className={labelClass} htmlFor="targetEndDate">
              {t("Target end date")}
            </label>
            <input id="targetEndDate" name="targetEndDate" type="date" className={inputClass} defaultValue={initial?.targetEndDate} />
          </div>

          <div>
            <label className={labelClass} htmlFor="value">
              {fmt(t("Contract value ({currency})"), { currency: getSystemCurrency() })}
            </label>
            <input id="value" name="value" type="number" min="0" step="0.01" className={inputClass} placeholder="0" defaultValue={initial?.value ? initial.value : undefined} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="siteAddress">
              {t("Site address")}
            </label>
            <input id="siteAddress" name="siteAddress" className={inputClass} placeholder={t("e.g. Dubai Marina, Plot D2, Dubai")} defaultValue={initial?.siteAddress} />
          </div>

          <div className="sm:col-span-2">
            <span className={labelClass}>{t("Disciplines")}</span>
            <div className="flex flex-wrap gap-3">
              {DISCIPLINES.map((d) => (
                <label key={d} className="inline-flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" name="disciplines" value={d} defaultChecked={initial?.disciplines.includes(d)} className="h-4 w-4 rounded border-border text-brand focus:ring-brand/30" />
                  {t(DISCIPLINE_LABEL[d])}
                </label>
              ))}
              <label className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#4b5320] dark:text-[#c5d18a]">
                <input
                  type="checkbox"
                  name="development"
                  checked={devTicked}
                  onChange={(e) => {
                    setDevTicked(e.target.checked);
                    setDevError(null);
                  }}
                  className="h-4 w-4 rounded border-[#5c6633] accent-[#4b5320] focus:ring-[#8a9a5b]/30"
                />
                {t("DEVELOPMENT")}
              </label>
            </div>

            {devTicked ? (
              <div className="mt-3 rounded-lg border border-[#5c6633] bg-[#e4e8dc]/60 p-3 dark:bg-[#4b5320]/25">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={devLabelClass} htmlFor="developmentType">
                      {t("DEVELOPMENT TYPE")} *
                    </label>
                    <select
                      id="developmentType"
                      name="developmentType"
                      className={`${devInputClass} uppercase tracking-wide`}
                      value={devType}
                      aria-invalid={devError === DEVELOPMENT_ERRORS.type || undefined}
                      onChange={(e) => {
                        setDevType(e.target.value);
                        setDevError(null);
                      }}
                    >
                      <option value="">{t("— SELECT —")}</option>
                      {DEVELOPMENT_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {t(DEVELOPMENT_TYPE_OPTION[d])}
                        </option>
                      ))}
                    </select>
                  </div>

                  {devType === "OTHER" ? (
                    <div>
                      <label className={devLabelClass} htmlFor="developmentTypeOther">
                        {t("TYPE OF DEVELOPMENT")} *
                      </label>
                      <input
                        id="developmentTypeOther"
                        name="developmentTypeOther"
                        className={devInputClass}
                        maxLength={DEVELOPMENT_OTHER_MAX}
                        placeholder={t("e.g. Marina Lofts")}
                        value={devOther}
                        aria-invalid={(devError !== null && devError !== DEVELOPMENT_ERRORS.type) || undefined}
                        onChange={(e) => {
                          setDevOther(e.target.value);
                          setDevError(null);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                {devError ? (
                  <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t(devError)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="description">
              {t("Description")}
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder={t("Scope summary, key requirements…")}
              defaultValue={initial?.description}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {t("Cancel")}
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("Saving…") : mode === "edit" ? t("Save changes") : t("Create project")}
        </button>
      </div>
    </form>
  );
}
