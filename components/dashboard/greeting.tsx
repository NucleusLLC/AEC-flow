"use client";

import { useT } from "@/components/i18n/language-provider";

/**
 * Time-of-day greeting for the signed-in user. The period is derived from the
 * browser's local clock at render; `suppressHydrationWarning` absorbs the
 * server/client time difference (the client value wins after hydration).
 */
function periodFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const t = useT();
  const period = t(periodFor(new Date().getHours()));
  return (
    <h2 suppressHydrationWarning className="text-xl font-semibold text-fg">
      {period}
      {name ? `, ${name}` : ""}
    </h2>
  );
}
