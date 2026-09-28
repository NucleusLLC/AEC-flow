/**
 * Documents written with AI — the pure half. CLIENT-SAFE: no Prisma, no key.
 *
 * The user types what the document is for in a sentence or two, picks what kind
 * of document it is, the style and the language, and the model writes the
 * wording. Everything around the wording — letterhead, number, date, addressee,
 * signature block — is the sheet's, exactly as for every other general document,
 * so the model is asked for the title, the subject line and the paragraphs and
 * nothing else.
 *
 * ─── THE MODEL NEVER INVENTS A FACT ─────────────────────────────────────────
 * A plausible amount, date, parcel number or name that nobody typed is worse
 * than a blank: a blank gets filled in, a wrong date gets signed. So anything
 * the summary and the particulars do not state is written as `__________` and
 * listed in `missing`, and a document with a blank left in it cannot be issued
 * (lib/general-documents/schema.ts, `issueBlockers`).
 *
 * ─── MILITARY IS THE HOUSE STYLE ────────────────────────────────────────────
 * Bottom line up front, numbered paragraphs, short active sentences, dates as
 * 16 SEP 2026 — the same date form the whole app prints. It is the default
 * because a letter from a practice is read by someone deciding something, and
 * the decision belongs in the first paragraph. Formal and Friendly remain.
 *
 * The prompt is built here, not in the server module, so it can be tested
 * without a network call and read in one place.
 */
import { z } from "zod";

/** The catalogue key a document written with AI is stored under. Never renamed. */
export const AI_DRAFT_TYPE = "ai_draft";

// ── What the user chooses ──────────────────────────────────────────────────

export type AiDraftKind =
  "LETTER" | "MEMO" | "NOTICE" | "REQUEST" | "TRANSMITTAL" | "REPORT" | "OTHER";

export const AI_DRAFT_KINDS: AiDraftKind[] = [
  "LETTER",
  "MEMO",
  "NOTICE",
  "REQUEST",
  "TRANSMITTAL",
  "REPORT",
  "OTHER",
];

/** Also what the letterhead and the register call the finished document. */
export const AI_DRAFT_KIND_LABEL: Record<AiDraftKind, string> = {
  LETTER: "Letter",
  MEMO: "Memorandum",
  NOTICE: "Notice",
  REQUEST: "Request",
  TRANSMITTAL: "Transmittal",
  REPORT: "Report",
  OTHER: "Document",
};

export type AiDraftStyle = "MILITARY" | "FORMAL" | "FRIENDLY";

export const AI_DRAFT_STYLES: AiDraftStyle[] = [
  "MILITARY",
  "FORMAL",
  "FRIENDLY",
];

export const AI_DRAFT_STYLE_LABEL: Record<AiDraftStyle, string> = {
  MILITARY: "Military",
  FORMAL: "Formal",
  FRIENDLY: "Friendly",
};

export const AI_DRAFT_STYLE_BLURB: Record<AiDraftStyle, string> = {
  MILITARY: "Bottom line first, numbered paragraphs, no filler.",
  FORMAL: "Conventional business correspondence.",
  FRIENDLY: "Warm and plain, still professional.",
};

/** Every UI language, so a draft can always start in the language the user is working in. */
export type AiDraftLanguage = "en" | "es" | "nl" | "de" | "zh" | "ja" | "pt";

export const AI_DRAFT_LANGUAGES: AiDraftLanguage[] = ["en", "es", "nl", "de", "zh", "ja", "pt"];

/** Shown in the picker (through t()) and named to the model, so each is unambiguous. */
export const AI_DRAFT_LANGUAGE_LABEL: Record<AiDraftLanguage, string> = {
  en: "English",
  es: "Spanish",
  nl: "Dutch",
  de: "German",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  pt: "Portuguese (Brazil)",
};

export const SUMMARY_MIN = 10;
export const SUMMARY_MAX = 4000;

/** What the model writes in place of a fact nobody gave it. */
export const BLANK = "__________";

// ── What the composer sends ────────────────────────────────────────────────

/** What the document already knows, filled in by the composer. All optional. */
export type AiDraftContext = {
  firmName: string | null;
  clientName: string | null;
  projectName: string | null;
  counterpartyName: string | null;
  counterpartyAddress: string | null;
  contactName: string | null;
  subject: string | null;
  reference: string | null;
  /** Already in the house form, e.g. "16 SEP 2026". */
  date: string | null;
};

export type AiDraftRequest = {
  summary: string;
  kind: AiDraftKind;
  style: AiDraftStyle;
  language: AiDraftLanguage;
  context: AiDraftContext;
};

const contextText = z
  .union([z.string().trim().max(500), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const aiDraftRequestSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(
      SUMMARY_MIN,
      `Describe the document in at least ${SUMMARY_MIN} characters.`,
    )
    .max(SUMMARY_MAX, `Keep the summary under ${SUMMARY_MAX} characters.`),
  kind: z.enum(AI_DRAFT_KINDS as [AiDraftKind, ...AiDraftKind[]]),
  style: z.enum(AI_DRAFT_STYLES as [AiDraftStyle, ...AiDraftStyle[]]),
  language: z.enum(
    AI_DRAFT_LANGUAGES as [AiDraftLanguage, ...AiDraftLanguage[]],
  ),
  context: z.object({
    firmName: contextText,
    clientName: contextText,
    projectName: contextText,
    counterpartyName: contextText,
    counterpartyAddress: contextText,
    contactName: contextText,
    subject: contextText,
    reference: contextText,
    date: contextText,
  }),
});

export function parseAiDraftRequest(
  input: unknown,
): { ok: true; value: AiDraftRequest } | { ok: false; error: string } {
  const parsed = aiDraftRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "That request could not be read.",
    };
  }
  return { ok: true, value: parsed.data as AiDraftRequest };
}

// ── What comes back ────────────────────────────────────────────────────────

export type AiDraft = {
  title: string;
  subject: string;
  paragraphs: string[];
  /** The facts the model left as blanks, in the document's own language. */
  missing: string[];
};

/** The structured output the model must return (output_config.format). */
export const AI_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subject", "paragraphs", "missing"],
  properties: {
    title: {
      type: "string",
      description: "The document's heading, short, in the document's language.",
    },
    subject: {
      type: "string",
      description:
        "One subject line, or an empty string when the heading already says it.",
    },
    paragraphs: {
      type: "array",
      items: { type: "string" },
      description: "The body, one entry per paragraph, in order.",
    },
    missing: {
      type: "array",
      items: { type: "string" },
      description: "Each fact written as a blank because it was not given.",
    },
  },
} as const;

const MAX_PARAGRAPHS = 60;
const MAX_PARAGRAPH_CHARS = 4000;
const MAX_LINE_CHARS = 300;

/**
 * Read the model's answer. Tolerant of a fenced block or a sentence around the
 * JSON — structured output makes that unlikely, not impossible — and strict
 * about the shape: no paragraphs means no draft.
 */
export function parseDraft(raw: string): AiDraft | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) candidates.push(fenced[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      if (!obj || typeof obj !== "object") continue;
      const draft = normaliseDraft(obj);
      if (draft) return draft;
    } catch {
      // try the next shape
    }
  }
  return null;
}

const line = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

export function normaliseDraft(obj: Record<string, unknown>): AiDraft | null {
  const paragraphs = (Array.isArray(obj.paragraphs) ? obj.paragraphs : [])
    .map((p) => (typeof p === "string" ? p.replace(/\r\n/g, "\n").trim() : ""))
    .filter(Boolean)
    .map((p) => p.slice(0, MAX_PARAGRAPH_CHARS))
    .slice(0, MAX_PARAGRAPHS);
  if (paragraphs.length === 0) return null;
  const missing = (Array.isArray(obj.missing) ? obj.missing : [])
    .map((m) => line(m, MAX_LINE_CHARS))
    .filter(Boolean)
    .slice(0, 30);
  return {
    title: line(obj.title, MAX_LINE_CHARS),
    subject: line(obj.subject, MAX_LINE_CHARS),
    paragraphs,
    missing,
  };
}

/** True when the wording still has a blank the model left for a missing fact. */
export function hasBlank(paragraphs: string[]): boolean {
  return paragraphs.some((p) => p.includes("_____"));
}

// ── Stored with the document ───────────────────────────────────────────────

/** What the draft was asked for, kept on the row's `values` so it can be rewritten. */
export function draftValues(
  req: AiDraftRequest,
  model: string,
): Record<string, string> {
  return {
    aiSummary: req.summary,
    aiKind: req.kind,
    aiStyle: req.style,
    aiLanguage: req.language,
    aiModel: model,
  };
}

export function isAiDraftKind(v: unknown): v is AiDraftKind {
  return typeof v === "string" && (AI_DRAFT_KINDS as string[]).includes(v);
}

/** The kind label for a stored document, or null when it is not an AI draft. */
export function aiKindLabel(
  docType: string,
  values: Record<string, string> | undefined,
): string | null {
  if (docType !== AI_DRAFT_TYPE) return null;
  const kind = values?.aiKind;
  return isAiDraftKind(kind) ? AI_DRAFT_KIND_LABEL[kind] : null;
}

// ── The prompt ─────────────────────────────────────────────────────────────

const STYLE_RULES: Record<AiDraftStyle, string> = {
  MILITARY: [
    "Write in military correspondence style:",
    "- Paragraph 1 is the bottom line up front: what this document is, and exactly what is decided, requested or required, and by when.",
    "- Number the paragraphs 1., 2., 3. Use a., b., c. for sub-points inside a paragraph.",
    "- Short, active sentences. One idea per paragraph. No pleasantries, no filler, no hedging.",
    "- Write every date in the form 16 SEP 2026 (day, three-letter month in capitals, year).",
    "- End with one paragraph naming the point of contact for questions.",
    "- No salutation and no complimentary close — the sheet prints the signature block.",
  ].join("\n"),
  FORMAL: [
    "Write in a formal business style:",
    '- Open with a salutation to the addressee when one is known (e.g. "Dear Mr. …,"), otherwise a neutral one.',
    "- Clear, courteous, precise. State the purpose in the first paragraph.",
    '- Close with a conventional complimentary close (e.g. "Yours sincerely,") as its own final paragraph.',
    "- Do not type a name or signature under the close — the sheet prints the signature block.",
  ].join("\n"),
  FRIENDLY: [
    "Write in a warm, plain, professional style:",
    "- A friendly salutation, plain words, short paragraphs.",
    "- Still precise about anything decided, requested or owed.",
    '- A friendly close (e.g. "Kind regards,") as its own final paragraph, with no name under it.',
  ].join("\n"),
};

const KIND_RULES: Record<AiDraftKind, string> = {
  LETTER: "A letter from the practice to the addressee.",
  MEMO: "An internal or project memorandum. A memo carries no salutation or complimentary close in any style.",
  NOTICE:
    "A formal notice that puts a fact on the record, with the date it takes effect.",
  REQUEST:
    "A request for information, a price, a decision or more time, with a clear response date.",
  TRANSMITTAL:
    "A transmittal listing what is enclosed or sent, why, and what the recipient must do with it.",
  REPORT:
    "A short report: situation, findings, and recommendations, in that order.",
  OTHER:
    "Whatever document the summary describes. Choose the conventional form for it.",
};

function contextLines(c: AiDraftContext): string[] {
  const rows: [string, string | null][] = [
    ["From (the practice)", c.firmName],
    ["Date of the document", c.date],
    ["Our reference", c.reference],
    ["Client", c.clientName],
    ["Project", c.projectName],
    ["Addressed to (organisation)", c.counterpartyName],
    ["Their address", c.counterpartyAddress],
    ["Addressed to (person)", c.contactName],
    ["Subject given by the user", c.subject],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
}

/**
 * The system prompt and the user message. The system prompt is fixed (so it
 * caches); everything that varies per request is in the user message.
 */
export function buildDraftPrompt(req: AiDraftRequest): {
  system: string;
  user: string;
} {
  const system = [
    "You draft documents for an architecture, engineering and project-management practice.",
    "The document is printed on the practice's letterhead. The sheet already prints the letterhead, the document number, the date, the addressee's name and address, and a signature block. Never write any of those yourself: no letterhead, no address block, no date line, no reference line, no \"Subject:\" line, no signature, no name under the close.",
    "",
    "Facts:",
    `- Use only the facts in the summary and the particulars. Never invent an amount, a date, a deadline, a name, a parcel or permit number, a quantity or a legal reference. Where the document needs a fact that was not given, write ${BLANK} in its place and add a short description of that fact to "missing".`,
    '- Refer to the practice as "we". Refer to the client and the addressee by the names given.',
    '- If the summary asks for something unlawful or deceptive, write the document without that part and say so in "missing".',
    "",
    "Form:",
    "- Return the body as separate paragraphs, one per array entry, without blank lines inside a paragraph unless it is a list.",
    "- The title is the document's heading, not a sentence. Keep it under ten words.",
    "- The subject is one line; use an empty string when the title already says it.",
    '- Write the title, subject, paragraphs and every "missing" entry in the requested language only.',
  ].join("\n");

  const particulars = contextLines(req.context);
  const user = [
    `Kind of document: ${AI_DRAFT_KIND_LABEL[req.kind]}. ${KIND_RULES[req.kind]}`,
    `Language: ${AI_DRAFT_LANGUAGE_LABEL[req.language]}.`,
    "",
    STYLE_RULES[req.style],
    "",
    "Particulars already on the document:",
    particulars.length > 0 ? particulars.join("\n") : "(none)",
    "",
    "What the user wants the document to say:",
    "<summary>",
    req.summary,
    "</summary>",
  ].join("\n");

  return { system, user };
}
