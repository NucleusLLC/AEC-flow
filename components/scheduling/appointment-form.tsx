"use client";

/**
 * Booking (and editing) an appointment.
 *
 * Only ids leave this form: the project, proposal and attendee names are read
 * on the server from the practice's own records. The rules repeated here (a
 * link is required, the end after the start) are for the person typing — the
 * zod gate in lib/scheduling/schema.ts is the control.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Save } from "lucide-react";
import {
  createAppointmentAction,
  updateAppointmentAction,
} from "@/app/(app)/scheduling/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { formatHours, plannedHours, toWallClockUtc } from "@/lib/scheduling/calc";
import {
  APPOINTMENT_TYPE_LABEL,
  APPOINTMENT_TYPES,
  type AppointmentDTO,
  type AppointmentType,
  type PickerOption,
  type ProposalOption,
} from "@/lib/scheduling/types";

const INPUT =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const LABEL = "mb-1 block text-xs font-medium text-muted";

export function AppointmentForm({
  mode,
  initial,
  defaults,
  projects,
  proposals,
  team,
}: {
  mode: "new" | "edit";
  initial?: AppointmentDTO;
  defaults?: {
    projectId?: string | null;
    serviceProposalId?: string | null;
    type?: AppointmentType | null;
    date: string;
    attendeeIds?: string[];
  };
  projects: PickerOption[];
  proposals: ProposalOption[];
  team: PickerOption[];
}) {
  const t = useT();
  const router = useRouter();

  const startType: AppointmentType = initial?.type ?? defaults?.type ?? "MEETING";
  const [type, setType] = useState<AppointmentType>(startType);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(initial));
  const [projectId, setProjectId] = useState(initial?.projectId ?? defaults?.projectId ?? "");
  const [proposalId, setProposalId] = useState(
    initial?.serviceProposalId ?? defaults?.serviceProposalId ?? "",
  );
  const [date, setDate] = useState(initial?.date ?? defaults?.date ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "10:00");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [attendees, setAttendees] = useState<string[]>(initial?.attendeeIds ?? defaults?.attendeeIds ?? []);
  const [external, setExternal] = useState(initial?.externalAttendees ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownTitle = titleTouched ? title : title || t(APPOINTMENT_TYPE_LABEL[type]);

  const planned = useMemo(() => {
    const s = toWallClockUtc(date, startTime);
    const e = toWallClockUtc(date, endTime);
    return s && e && e > s ? plannedHours(s, e) : null;
  }, [date, startTime, endTime]);

  const proposal = proposals.find((p) => p.id === proposalId);
  const proposalProject = proposal?.projectId ? projects.find((p) => p.id === proposal.projectId) : undefined;

  function toggle(id: string) {
    setAttendees((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId && !proposalId) {
      setError("Link it to a project or a service proposal");
      return;
    }
    if (planned === null) {
      setError("The end time must be after the start time");
      return;
    }
    setPending(true);
    const payload = {
      type,
      title: shownTitle,
      location,
      notes,
      date,
      startTime,
      endTime,
      projectId: projectId || null,
      serviceProposalId: proposalId || null,
      attendeeIds: attendees,
      externalAttendees: external,
    };
    const res =
      mode === "edit" && initial
        ? await updateAppointmentAction(initial.id, payload)
        : await createAppointmentAction(payload);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.push(`/scheduling/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title={t("What and when")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="sch-type">
              {t("Type")}
            </label>
            <select
              id="sch-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as AppointmentType)}
              className={INPUT}
            >
              {APPOINTMENT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(APPOINTMENT_TYPE_LABEL[k])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="sch-title">
              {t("Title")}
            </label>
            <input
              id="sch-title"
              name="title"
              value={shownTitle}
              maxLength={200}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="sch-date">
              {t("Date")}
            </label>
            <input
              id="sch-date"
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sch-start">
                {t("Start")}
              </label>
              <input
                id="sch-start"
                name="startTime"
                type="time"
                step={300}
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="sch-end">
                {t("End")}
              </label>
              <input
                id="sch-end"
                name="endTime"
                type="time"
                step={300}
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={INPUT}
              />
            </div>
            <p className="col-span-2 text-[11px] text-faint">
              {planned === null
                ? t("The end time must be after the start time")
                : fmt(t("Planned: {hours}"), { hours: formatHours(planned) })}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="sch-location">
              {t("Location")}
            </label>
            <input
              id="sch-location"
              name="location"
              value={location}
              maxLength={300}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("Site address, office or video call")}
              className={INPUT}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Project or proposal")}
          subtitle={t("Link it to a project, or to a service proposal for a project that has not started yet. At least one is required.")}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="sch-project">
              {t("Project")}
            </label>
            <select
              id="sch-project"
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={INPUT}
            >
              <option value="">{t("No project")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="sch-proposal">
              {t("Service proposal")}
            </label>
            <select
              id="sch-proposal"
              name="serviceProposalId"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              className={INPUT}
            >
              <option value="">{t("No proposal")}</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {proposalProject && !projectId ? (
              <p className="mt-1 text-[11px] text-faint">
                {fmt(t("This proposal became {project}; the visit will be filed there too."), {
                  project: proposalProject.name,
                })}
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("Who attends")} />
        <CardBody className="space-y-4">
          {team.length === 0 ? (
            <p className="text-sm text-muted">{t("No team members.")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {team.map((m) => {
                const on = attendees.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      on ? "border-brand bg-brand/10 text-fg" : "border-border text-muted hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="attendeeIds"
                      value={m.id}
                      checked={on}
                      onChange={() => toggle(m.id)}
                      className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                    />
                    {m.name}
                  </label>
                );
              })}
            </div>
          )}
          <div>
            <label className={LABEL} htmlFor="sch-external">
              {t("Others attending")}
            </label>
            <input
              id="sch-external"
              name="externalAttendees"
              value={external}
              maxLength={1000}
              onChange={(e) => setExternal(e.target.value)}
              placeholder={t("Client, contractor, inspector…")}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="sch-notes">
              {t("Agenda / instructions")}
            </label>
            <textarea
              id="sch-notes"
              name="notes"
              value={notes}
              maxLength={4000}
              rows={4}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
        >
          {mode === "edit" ? <Save className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
          {pending ? t("Saving…") : mode === "edit" ? t("Save changes") : t("Book it")}
        </button>
        {error ? <p className="text-sm text-red-600">{t(error)}</p> : null}
      </div>
    </form>
  );
}
