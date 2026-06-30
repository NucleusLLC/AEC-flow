"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import {
  MEETING_TYPE_LABEL,
  ACTION_STATUS_LABEL,
  type MeetingType,
  type ActionStatus,
  type MeetingWriteInput,
} from "@/lib/data/meetings.types";
import { saveMeeting } from "@/app/(app)/meetings/actions";

type ActionItemForm = {
  description: string;
  assignee: string;
  dueDate: string;
  status: ActionStatus;
};

export type MeetingFormValues = {
  title: string;
  projectId: string;
  author: string;
  type: MeetingType;
  meetingDate: string;
  location: string;
  participants: string;
  summary: string;
  discussion: string;
  decisions: string;
  followUpDate: string;
  actionItems: ActionItemForm[];
};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const errCls = "mt-1 text-xs text-red-600";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function defaults(authorFallback: string): MeetingFormValues {
  return {
    title: "",
    projectId: "",
    author: authorFallback,
    type: "CLIENT",
    meetingDate: new Date().toISOString().slice(0, 10),
    location: "",
    participants: "",
    summary: "",
    discussion: "",
    decisions: "",
    followUpDate: "",
    actionItems: [],
  };
}

export function MeetingForm({
  mode,
  projects,
  users,
  initial,
  meetingId,
  backHref,
}: {
  mode: "new" | "edit";
  projects: { id: string; name: string }[];
  users: { name: string }[];
  initial?: MeetingFormValues;
  meetingId?: string;
  backHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MeetingFormValues>({
    defaultValues: initial ?? defaults(users[0]?.name ?? ""),
  });

  const actionItems = useFieldArray({ control, name: "actionItems" });

  function onSubmit(values: MeetingFormValues) {
    setError(null);
    const payload: MeetingWriteInput = {
      id: mode === "edit" ? meetingId : undefined,
      title: values.title,
      projectId: values.projectId,
      author: values.author,
      type: values.type,
      meetingDate: values.meetingDate,
      location: values.location,
      participants: values.participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      summary: values.summary,
      discussion: values.discussion,
      decisions: values.decisions,
      followUpDate: values.followUpDate,
      actionItems: (values.actionItems ?? []).map((a) => ({
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        status: a.status,
      })),
    };
    startTransition(async () => {
      const res = await saveMeeting(mode, payload);
      if (res.ok) {
        router.push(`/meetings/${res.id}`);
        router.refresh();
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">
              Couldn’t {mode === "new" ? "create" : "update"} the minutes.
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionHeader title="Meeting" />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Marina Heights Tower — Client Review #3"
                  {...register("title", {
                    required: "Title is required",
                    minLength: { value: 3, message: "Too short" },
                  })}
                />
                {errors.title ? <p className={errCls}>{errors.title.message}</p> : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Project</label>
                  <select
                    className={inputCls}
                    defaultValue=""
                    {...register("projectId", { required: "Select a project" })}
                  >
                    <option value="" disabled>
                      Select a project…
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.projectId ? <p className={errCls}>{errors.projectId.message}</p> : null}
                </div>
                <div>
                  <label className={labelCls}>Author</label>
                  <select className={inputCls} {...register("author", { required: true })}>
                    {users.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Type</label>
                  <select className={inputCls} {...register("type", { required: true })}>
                    {(Object.keys(MEETING_TYPE_LABEL) as MeetingType[]).map((t) => (
                      <option key={t} value={t}>
                        {MEETING_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    {...register("meetingDate", { required: "Date is required" })}
                  />
                  {errors.meetingDate ? <p className={errCls}>{errors.meetingDate.message}</p> : null}
                </div>
                <div>
                  <label className={labelCls}>Location</label>
                  <input className={inputCls} placeholder="e.g. Site office" {...register("location")} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Participants (comma-separated)</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Jane Smith, Site engineer, Client rep…"
                  {...register("participants")}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <SectionHeader title="Notes" />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Summary</label>
                <textarea
                  className={`${inputCls} h-auto min-h-[72px] py-2`}
                  placeholder="One-paragraph summary of the meeting…"
                  {...register("summary")}
                />
              </div>
              <div>
                <label className={labelCls}>Discussion</label>
                <textarea
                  className={`${inputCls} h-auto min-h-[120px] py-2`}
                  placeholder="Key points discussed…"
                  {...register("discussion")}
                />
              </div>
              <div>
                <label className={labelCls}>Decisions</label>
                <textarea
                  className={`${inputCls} h-auto min-h-[88px] py-2`}
                  placeholder="Decisions taken…"
                  {...register("decisions")}
                />
              </div>
            </CardBody>
          </Card>

          {/* Action items */}
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">Action Items</h3>
                <p className="text-xs text-muted">
                  {actionItems.fields.length} item{actionItems.fields.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  actionItems.append({
                    description: "",
                    assignee: users[0]?.name ?? "",
                    dueDate: "",
                    status: "OPEN",
                  })
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add action
              </button>
            </div>
            <CardBody className="space-y-2">
              {actionItems.fields.length === 0 ? (
                <p className="py-2 text-sm text-muted">No action items yet.</p>
              ) : null}
              {actionItems.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                  <input
                    className={`${inputCls} col-span-12 sm:col-span-5`}
                    placeholder="Description"
                    {...register(`actionItems.${i}.description` as const, { required: true })}
                  />
                  <select
                    className={`${inputCls} col-span-6 sm:col-span-3`}
                    {...register(`actionItems.${i}.assignee` as const)}
                  >
                    {users.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className={`${inputCls} col-span-4 sm:col-span-2`}
                    {...register(`actionItems.${i}.dueDate` as const)}
                  />
                  <select
                    className={`${inputCls} col-span-6 sm:col-span-1`}
                    {...register(`actionItems.${i}.status` as const)}
                  >
                    {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {ACTION_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => actionItems.remove(i)}
                    className="col-span-2 inline-flex h-9 items-center justify-center rounded-lg text-faint hover:text-red-600 sm:col-span-1"
                    aria-label="Remove action item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Follow-up" />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Follow-up date</label>
                <input type="date" className={inputCls} {...register("followUpDate")} />
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : mode === "new" ? "Create minutes" : "Save changes"}
            </button>
            <Link
              href={backHref}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
