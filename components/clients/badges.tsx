"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
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

/** Badge wording (lower case, as the badge has always shown it). */
const statusLabel: Record<ClientStatus, string> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PROSPECT: "prospect",
};

export function ClientTypeBadge({ type }: { type: ClientType }) {
  const t = useT();
  return <Badge tone={typeTone[type]}>{t(CLIENT_TYPE_LABEL[type])}</Badge>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const t = useT();
  return <Badge tone={statusTone[status]}>{t(statusLabel[status] ?? status.toLowerCase())}</Badge>;
}
