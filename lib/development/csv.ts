/**
 * Minimal CSV parser (client-safe, no deps) for the Land Development importers.
 * Handles quoted fields, escaped quotes ("") and commas/newlines inside quotes.
 * Returns rows of string cells; callers map columns to their row type.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n") {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Number coercion that tolerates currency symbols, thousands separators and blanks. */
export function csvNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Split a parsed CSV into a header-keyed accessor. If the first row looks like a
 * header (contains a non-numeric label that matches an expected key), it is used;
 * otherwise positional access via the provided `order` fallback applies.
 */
export function withHeader(rows: string[][], expected: string[]): { records: Array<Record<string, string>>; usedHeader: boolean } {
  if (rows.length === 0) return { records: [], usedHeader: false };
  const norm = (x: string) => x.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const first = rows[0].map(norm);
  const expectedNorm = expected.map(norm);
  const usedHeader = first.some((h) => expectedNorm.includes(h));
  const header = usedHeader ? rows[0].map(norm) : expectedNorm;
  const body = usedHeader ? rows.slice(1) : rows;
  const records = body.map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((key, i) => { rec[key] = (r[i] ?? "").trim(); });
    return rec;
  });
  return { records, usedHeader };
}
