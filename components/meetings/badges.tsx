import { Badge } from "@/components/ui/badge";
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
  return <Badge tone={typeTone[type]}>{MEETING_TYPE_LABEL[type]}</Badge>;
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Badge tone={statusTone[status]}>{ACTION_STATUS_LABEL[status]}</Badge>;
}
