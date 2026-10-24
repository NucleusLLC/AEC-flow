"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TONE,
  APPOINTMENT_TYPE_LABEL,
  APPOINTMENT_TYPE_TONE,
  type AppointmentStatus,
  type AppointmentType,
} from "@/lib/scheduling/types";

/** Status and type, on the app's existing <Badge> — no colour system of its own. */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useT();
  return <Badge tone={APPOINTMENT_STATUS_TONE[status]}>{t(APPOINTMENT_STATUS_LABEL[status])}</Badge>;
}

export function AppointmentTypeBadge({ type }: { type: AppointmentType }) {
  const t = useT();
  return <Badge tone={APPOINTMENT_TYPE_TONE[type]}>{t(APPOINTMENT_TYPE_LABEL[type])}</Badge>;
}
