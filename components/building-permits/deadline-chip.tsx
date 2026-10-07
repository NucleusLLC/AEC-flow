/**
 * The colour of a permit DEADLINE, as one chip: yellow more than 14 days out,
 * red inside 14, blinking red inside 3 and once overdue
 * (lib/building-permits/deadlines.ts). Used on the case file and the dashboards
 * so the three can never disagree.
 */
import { daysUntil, deadlineState, deadlineWhen, type DeadlineState } from "@/lib/building-permits/deadlines";

export const DEADLINE_CHIP_CLASS: Record<DeadlineState, string> = {
  YELLOW: "border-yellow-500 bg-yellow-300 text-yellow-950",
  RED: "border-red-700 bg-red-600 text-white",
  BLINK: "deadline-blink border-red-700",
};

export function DeadlineChip({ dueDate, today }: { dueDate: string; today: string }) {
  const state = deadlineState(dueDate, today);
  const days = daysUntil(today, dueDate);
  return (
    <span
      data-deadline-state={state}
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider tabular-nums ${DEADLINE_CHIP_CLASS[state]}`}
    >
      {deadlineWhen(days)}
    </span>
  );
}
