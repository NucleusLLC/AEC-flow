/**
 * The review register: every comment and redline on a drawing set, as a
 * document somebody can act on. PURE — rows in, a register out.
 *
 * ─── AN ITEM NOBODY CAN CITE IS AN ITEM NOBODY CLOSES ───────────────────────
 * Comments live on a screen, against a point on a sheet, and that is exactly
 * where they stay: a contractor on a site call cannot say "the red cloud, upper
 * left". So every item gets a reference — `A-101/3` — numbered per sheet in the
 * order the items were raised. The reference is the whole reason this register
 * exists, and it is stable: it is derived from creation order, not from the
 * current sort, so it does not change when somebody resolves item 2.
 *
 * ─── OPEN ITEMS ARE COUNTED PER PERSON, NOT JUST IN TOTAL ───────────────────
 * "Forty-one open" is a number that produces a meeting. "Eleven with the
 * structural engineer, nine unassigned" is a number that produces work. The
 * unassigned count is deliberately its own line: unassigned is the state in
 * which an item is nobody's problem and therefore never closes.
 *
 * ─── AGE IS IN DAYS, AND IT IS NOT HIDDEN ───────────────────────────────────
 * A register that shows only status lets a four-month-old comment sit beside
 * one raised this morning looking identical. Age is computed against a date the
 * CALLER passes, never `new Date()` inside: a printed register must say the
 * same thing tomorrow, and a function that reads the clock cannot be tested.
 *
 * ─── REDLINES COUNT AS ITEMS, WITH THEIR OWN NOTE ───────────────────────────
 * A cloud with "check this dimension" written beside it is a comment that
 * happens to be drawn. Markup that carries text is listed; markup that is only
 * a line is counted but not listed, because "someone drew a line" is not an
 * action anybody can take.
 */

export type RegisterStatus = "OPEN" | "RESOLVED";

export type RegisterSheet = {
  drawingId: string;
  sheetNumber: string;
  title: string;
  revision: string;
  discipline: string;
};

export type RegisterSource = {
  id: string;
  drawingId: string;
  page: number;
  /** A comment, or a redline that carries a note. */
  kind: "COMMENT" | "MARKUP";
  body: string;
  status: RegisterStatus;
  authorName: string;
  assignedToName: string | null;
  resolvedByName: string | null;
  /** ISO. */
  createdAt: string;
  resolvedAt: string | null;
};

export type RegisterItem = RegisterSource & {
  /** `A-101/3` — the citable reference. */
  ref: string;
  sheetNumber: string;
  sheetTitle: string;
  /** Days between raising and resolution, or between raising and `asOf`. */
  ageDays: number;
};

export type RegisterSheetGroup = {
  sheet: RegisterSheet;
  items: RegisterItem[];
  open: number;
  resolved: number;
  /** Redlines with no note: counted, not listed. See the note at the top. */
  unlabelledMarkups: number;
};

export type RegisterTotals = {
  sheets: number;
  /** Sheets that carry at least one item. */
  sheetsWithItems: number;
  items: number;
  open: number;
  resolved: number;
  unassigned: number;
  unlabelledMarkups: number;
  /** Open items only, by the person they sit with, most first. */
  byAssignee: { name: string; open: number }[];
  /** The oldest open item's age in days, or 0. */
  oldestOpenDays: number;
};

export type ReviewRegister = {
  groups: RegisterSheetGroup[];
  totals: RegisterTotals;
};

export type RegisterFilter = {
  /** "OPEN" hides everything already closed — the working copy. */
  status?: RegisterStatus | "ALL";
  /** Only items sitting with this person. Empty string means unassigned. */
  assignedTo?: string;
  /** Sheets with nothing on them are dropped unless this is true. */
  includeEmptySheets?: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

function days(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / DAY));
}

/** Sheet numbers sort the way a drawing set is filed: A-9 before A-10. */
export function compareSheets(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Build the register.
 *
 * `asOf` is an ISO instant the caller supplies — the moment the register is
 * being printed. Nothing here reads the clock.
 */
export function buildRegister(input: {
  sheets: RegisterSheet[];
  items: RegisterSource[];
  /** Redlines carrying no text, per drawing id. */
  unlabelledMarkups?: Record<string, number>;
  asOf: string;
  filter?: RegisterFilter;
}): ReviewRegister {
  const filter = input.filter ?? {};
  const wantStatus = filter.status ?? "ALL";
  const unlabelled = input.unlabelledMarkups ?? {};

  const bySheet = new Map<string, RegisterSource[]>();
  for (const item of input.items) {
    bySheet.set(item.drawingId, [...(bySheet.get(item.drawingId) ?? []), item]);
  }

  const sheets = [...input.sheets].sort((a, b) => compareSheets(a.sheetNumber, b.sheetNumber));
  const groups: RegisterSheetGroup[] = [];

  for (const sheet of sheets) {
    // Numbered in the order raised, BEFORE filtering: a reference that changes
    // when the register is filtered to open items is not a reference. Item 3
    // is item 3 whether or not items 1 and 2 are still showing.
    const raised = [...(bySheet.get(sheet.drawingId) ?? [])].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
    );

    const numbered: RegisterItem[] = raised.map((item, i) => ({
      ...item,
      ref: `${sheet.sheetNumber}/${i + 1}`,
      sheetNumber: sheet.sheetNumber,
      sheetTitle: sheet.title,
      ageDays: days(item.createdAt, item.resolvedAt ?? input.asOf),
    }));

    const shown = numbered.filter((item) => {
      if (wantStatus !== "ALL" && item.status !== wantStatus) return false;
      if (filter.assignedTo !== undefined) {
        const who = item.assignedToName ?? "";
        if (who !== filter.assignedTo) return false;
      }
      return true;
    });

    const group: RegisterSheetGroup = {
      sheet,
      items: shown,
      open: numbered.filter((i) => i.status === "OPEN").length,
      resolved: numbered.filter((i) => i.status === "RESOLVED").length,
      unlabelledMarkups: unlabelled[sheet.drawingId] ?? 0,
    };

    if (shown.length === 0 && group.unlabelledMarkups === 0 && !filter.includeEmptySheets) continue;
    groups.push(group);
  }

  return { groups, totals: totalsFor(groups, sheets.length) };
}

function totalsFor(groups: RegisterSheetGroup[], sheetCount: number): RegisterTotals {
  const all = groups.flatMap((g) => g.items);
  const open = all.filter((i) => i.status === "OPEN");

  const byName = new Map<string, number>();
  for (const item of open) {
    const name = item.assignedToName?.trim() || "Unassigned";
    byName.set(name, (byName.get(name) ?? 0) + 1);
  }

  return {
    sheets: sheetCount,
    sheetsWithItems: groups.filter((g) => g.items.length > 0).length,
    items: all.length,
    open: open.length,
    resolved: all.length - open.length,
    unassigned: open.filter((i) => !i.assignedToName?.trim()).length,
    unlabelledMarkups: groups.reduce((n, g) => n + g.unlabelledMarkups, 0),
    byAssignee: [...byName.entries()]
      .map(([name, n]) => ({ name, open: n }))
      // Most first; "Unassigned" last on a tie, because it is a bucket rather
      // than a person and should not head the list by alphabetical accident.
      .sort((a, b) => b.open - a.open || (a.name === "Unassigned" ? 1 : a.name.localeCompare(b.name))),
    oldestOpenDays: open.reduce((n, i) => Math.max(n, i.ageDays), 0),
  };
}

/** One line for the head of the register. */
export function registerSummary(totals: RegisterTotals): string {
  if (totals.items === 0) return "Nothing raised against this set.";
  const bits = [`${totals.open} open`, `${totals.resolved} resolved`];
  if (totals.unassigned > 0) bits.push(`${totals.unassigned} unassigned`);
  if (totals.oldestOpenDays > 0) bits.push(`oldest ${totals.oldestOpenDays} days`);
  return `${bits.join(" · ")} across ${totals.sheetsWithItems} of ${totals.sheets} sheets.`;
}
