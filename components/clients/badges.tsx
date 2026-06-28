import { Badge } from "@/components/ui/badge";
import { CLIENT_TYPE_LABEL, type ClientType, type ClientStatus } from "@/lib/data/clients.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const typeTone: Record<ClientType, Tone> = {
  DEVELOPER: "blue",
  GOVERNMENT: "violet",
  HOSPITALITY: "amber",
  HEALTHCARE: "green",
  COMMERCIAL: "blue",
  RESIDENTIAL: "slate",
  PRIVATE: "neutral",
};

const statusTone: Record<ClientStatus, Tone> = {
  ACTIVE: "green",
  INACTIVE: "slate",
  PROSPECT: "violet",
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  return <Badge tone={typeTone[type]}>{CLIENT_TYPE_LABEL[type]}</Badge>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={statusTone[status]}>{status.toLowerCase()}</Badge>;
}
