/**
 * Filling a catalogue template. PURE — no Prisma, no React, no I/O.
 *
 * The composer renders here, the printed sheet renders the STORED result, and
 * the two are the same function so a document cannot read one way on screen and
 * another on paper.
 *
 * AN UNFILLED TOKEN BECOMES A RULE, NOT AN EMPTY SPACE. A power of attorney
 * that silently drops "until {{expiryDate}}" reads as though it never expires.
 * A visible `__________` is what a paper document does with a blank, and it is
 * the honest thing to print: someone will fill it in by hand or notice it is
 * missing. `requiredMissing` is what stops the important ones reaching paper at
 * all.
 */
import { catalogueEntry } from "./catalogue";
import type { CatalogueEntry, FieldDef } from "./types";

/** What a blank token prints as. Long enough to be written on. */
export const BLANK = "__________";

/** Everything a template may refer to, beyond its own fields. */
export type RenderContext = {
  firmName?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  projectAddress?: string | null;
  counterpartyName?: string | null;
  counterpartyAddress?: string | null;
  contactName?: string | null;
  subject?: string | null;
  reference?: string | null;
  number?: string | null;
  issueDate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
};

const CONTEXT_KEYS: (keyof RenderContext)[] = [
  "firmName",
  "clientName",
  "projectName",
  "projectAddress",
  "counterpartyName",
  "counterpartyAddress",
  "contactName",
  "subject",
  "reference",
  "number",
  "issueDate",
  "effectiveDate",
  "expiryDate",
];

/**
 * One flat lookup: the document's own context first, then its field values.
 *
 * Field values win over context so a template can deliberately shadow a name —
 * a power of attorney's `principalName` is the client's legal name, which is
 * not always the `clientName` the practice files them under.
 */
function lookup(context: RenderContext, values: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) map.set(key, value.trim());
  }
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === "string" && value.trim()) map.set(key, value.trim());
  }
  return map;
}

/** Replace every `{{token}}` in one string. */
export function fillTokens(
  text: string,
  context: RenderContext,
  values: Record<string, string> = {},
): string {
  const map = lookup(context, values);
  return String(text ?? "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, token: string) =>
    map.get(token) ?? BLANK,
  );
}

/**
 * The body, as paragraphs.
 *
 * A paragraph whose ONLY content was a token nobody filled is dropped rather
 * than printed as a bare rule: "Background: __________" is a question the reader
 * can answer, but a lone `__________` is a typographical accident. A multi-line
 * field value (the composer's textareas) becomes its own run of paragraphs so
 * the sheet keeps the line breaks the writer typed.
 */
export function renderBody(
  template: string[],
  context: RenderContext,
  values: Record<string, string> = {},
): string[] {
  const out: string[] = [];
  for (const paragraph of template ?? []) {
    const filled = fillTokens(paragraph, context, values).trim();
    if (!filled) continue;
    if (filled === BLANK) continue;
    for (const line of filled.split(/\n+/)) {
      const trimmed = line.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

/** The document's default title, from the entry's own template. */
export function renderTitle(
  entry: CatalogueEntry,
  context: RenderContext,
  values: Record<string, string> = {},
): string {
  const title = fillTokens(entry.titleTemplate, context, values)
    // A title is a heading, not a form: a blank in it reads as a mistake, so
    // the rule is stripped and the punctuation around it tidied.
    .split(BLANK)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s*[—–-]\s*$/, "")
    .replace(/^\s*[—–-]\s*/, "")
    .trim();
  return title || entry.label;
}

/** Signature block roles, with their tokens filled. */
export function renderSignatures(
  entry: CatalogueEntry,
  context: RenderContext,
  values: Record<string, string> = {},
): { role: string; name: string; witness: boolean }[] {
  return entry.signatures.map((block) => {
    const name =
      block.party === "firm"
        ? (context.firmName ?? "")
        : block.party === "client"
          ? (context.clientName ?? "")
          : block.party === "counterparty"
            ? (context.counterpartyName ?? "")
            : "";
    return {
      role: fillTokens(block.role, context, values),
      name: name || "",
      witness: Boolean(block.witness),
    };
  });
}

/** The required fields with nothing in them, by label — what the composer shows. */
export function requiredMissing(
  entry: CatalogueEntry,
  values: Record<string, string> = {},
): FieldDef[] {
  return entry.fields.filter((f) => f.required && !String(values?.[f.key] ?? "").trim());
}

/**
 * Every token a template uses that neither the context nor the entry's own
 * fields can ever fill. A drift check, not a runtime path:
 * `lib/general-documents/catalogue.test.ts` fails the build on a typo like
 * `{{clientNmae}}`, which would otherwise print a rule on a real document.
 */
export function unknownTokens(entry: CatalogueEntry): string[] {
  const known = new Set<string>([...CONTEXT_KEYS.map(String), ...entry.fields.map((f) => f.key)]);
  const found = new Set<string>();
  const texts = [entry.titleTemplate, ...entry.body, ...entry.signatures.map((s) => s.role)];
  for (const text of texts) {
    for (const m of text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
      if (!known.has(m[1])) found.add(m[1]);
    }
  }
  return [...found];
}

/** `GD-{year}-{NNN}`, one past the highest ever used in the practice. */
export function nextDocumentNumber(existing: string[], year: number): string {
  let max = 0;
  for (const number of existing) {
    const m = /(\d+)\s*$/.exec(number);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `GD-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Compose a document from a catalogue key. Null when the key is not known. */
export function compose(
  docType: string,
  context: RenderContext,
  values: Record<string, string> = {},
): { entry: CatalogueEntry; title: string; body: string[]; missing: FieldDef[] } | null {
  const entry = catalogueEntry(docType);
  if (!entry) return null;
  return {
    entry,
    title: renderTitle(entry, context, values),
    body: renderBody(entry.body, context, values),
    missing: requiredMissing(entry, values),
  };
}
