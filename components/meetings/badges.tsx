"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import {
  MEETING_TYPE_LABEL,
  ACTION_STATUS_LABEL,
  type MeetingType,
  type ActionStatus,
} from "@/lib/data/meetings.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const typeTone: Record<MeetingType, Tone> = {
  CLIENT: "blue",
  INTERNAL: "slate",
  SITE: "amber",
  AUTHORITY: "violet",
  VIRTUAL: "green",
};

const statusTone: Record<ActionStatus, Tone> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  DONE: "green",
  CANCELLED: "slate",
};

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const t = useT();
  return <Badge tone={typeTone[type]}>{t(MEETING_TYPE_LABEL[type])}</Badge>;
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const t = useT();
  return <Badge tone={statusTone[status]}>{t(ACTION_STATUS_LABEL[status])}</Badge>;
}
