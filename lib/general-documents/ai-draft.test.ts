import { describe, expect, it } from "vitest";
import {
  AI_DRAFT_LANGUAGES,
  AI_DRAFT_TYPE,
  BLANK,
  aiKindLabel,
  buildDraftPrompt,
  draftValues,
  hasBlank,
  parseAiDraftRequest,
  parseDraft,
  type AiDraftRequest,
} from "./ai-draft";
import { AI_DRAFT_ENTRY, CATALOGUE, catalogueByCategory, catalogueEntry, docTypeLabel } from "./catalogue";
import { issueBlockers, parseGeneralDocumentInput } from "./schema";
import { LANG_CODES } from "@/lib/i18n/types";

const context = {
  firmName: "Fixture Architects",
  clientName: "Playa Linda Holding",
  projectName: "Villa Malmok",
  counterpartyName: "Caribbean Builders N.V.",
  counterpartyAddress: null,
  contactName: "Mr. Croes",
  subject: null,
  reference: "ZA-2026-128",
  date: "27 SEP 2026",
};

const request: AiDraftRequest = {
  summary: "Tell the contractor the roof slab pour is postponed until the engineer approves the rebar.",
  kind: "LETTER",
  style: "MILITARY",
  language: "nl",
  context,
};

describe("parseAiDraftRequest — the action's gate", () => {
  it("accepts a real request and trims the summary", () => {
    const res = parseAiDraftRequest({ ...request, summary: `  ${request.summary}  ` });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.summary).toBe(request.summary);
  });

  it("refuses a summary too short to write from", () => {
    const res = parseAiDraftRequest({ ...request, summary: "hi" });
    expect(res).toEqual({ ok: false, error: "Describe the document in at least 10 characters." });
  });

  it("refuses a summary over the limit", () => {
    const res = parseAiDraftRequest({ ...request, summary: "x".repeat(4001) });
    expect(res).toEqual({ ok: false, error: "Keep the summary under 4000 characters." });
  });

  it("refuses a kind, style or language it does not offer", () => {
    expect(parseAiDraftRequest({ ...request, kind: "POEM" }).ok).toBe(false);
    expect(parseAiDraftRequest({ ...request, style: "PIRATE" }).ok).toBe(false);
    expect(parseAiDraftRequest({ ...request, language: "fr" }).ok).toBe(false);
  });

  it("turns empty particulars into nulls", () => {
    const res = parseAiDraftRequest({ ...request, context: { ...context, reference: "" } });
    expect(res.ok && res.value.context.reference).toBe(null);
  });
});

describe("draft languages", () => {
  it("include every UI language, so a draft can start in the one the user is using", () => {
    for (const l of LANG_CODES) expect(AI_DRAFT_LANGUAGES).toContain(l);
  });

  it("name the language to the model", () => {
    const { user } = buildDraftPrompt({ ...request, language: "ja" });
    expect(user).toContain("Language: Japanese.");
  });
});

describe("buildDraftPrompt", () => {
  const { system, user } = buildDraftPrompt(request);

  it("keeps the system prompt fixed, so it caches across requests", () => {
    const other = buildDraftPrompt({ ...request, summary: "Something else entirely.", style: "FRIENDLY" });
    expect(other.system).toBe(system);
  });

  it("forbids invented facts and names the blank to use instead", () => {
    expect(system).toContain("Never invent an amount, a date");
    expect(system).toContain(BLANK);
  });

  it("tells the model what the sheet already prints", () => {
    expect(system).toMatch(/no letterhead, no address block, no date line/);
  });

  it("carries the kind, the language, the style rules and the particulars", () => {
    expect(user).toContain("Kind of document: Letter.");
    expect(user).toContain("Language: Dutch.");
    expect(user).toContain("bottom line up front");
    expect(user).toContain("16 SEP 2026");
    expect(user).toContain("Client: Playa Linda Holding");
    expect(user).toContain("Our reference: ZA-2026-128");
  });

  it("leaves out particulars nobody filled in", () => {
    expect(user).not.toContain("Their address");
    expect(user).not.toContain("Subject given by the user");
  });

  it("fences the user's summary", () => {
    expect(user).toContain(`<summary>\n${request.summary}\n</summary>`);
  });

  it("asks a memo for no salutation, whatever the style", () => {
    const memo = buildDraftPrompt({ ...request, kind: "MEMO", style: "FORMAL" }).user;
    expect(memo).toContain("A memo carries no salutation or complimentary close");
  });
});

describe("parseDraft", () => {
  const answer = {
    title: "Uitstel storten dakvloer",
    subject: "",
    paragraphs: ["1. Het storten is uitgesteld.", "  ", "2. Nieuwe datum: __________."],
    missing: ["De nieuwe stortdatum"],
  };

  it("reads the structured answer and drops empty paragraphs", () => {
    expect(parseDraft(JSON.stringify(answer))).toEqual({
      title: "Uitstel storten dakvloer",
      subject: "",
      paragraphs: ["1. Het storten is uitgesteld.", "2. Nieuwe datum: __________."],
      missing: ["De nieuwe stortdatum"],
    });
  });

  it("survives a fenced block or a sentence around the JSON", () => {
    expect(parseDraft("Here it is:\n```json\n" + JSON.stringify(answer) + "\n```")?.title).toBe(
      "Uitstel storten dakvloer",
    );
    expect(parseDraft("Sure. " + JSON.stringify(answer) + " Done.")?.paragraphs).toHaveLength(2);
  });

  it("returns null when there is no body to show", () => {
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ ...answer, paragraphs: [] }))).toBeNull();
  });

  it("flattens a multi-line title into one line", () => {
    expect(parseDraft(JSON.stringify({ ...answer, title: "Line one\n line two" }))?.title).toBe(
      "Line one line two",
    );
  });
});

describe("what is stored and how it is called", () => {
  it("keeps what the draft was asked for on the row's values", () => {
    expect(draftValues(request, "claude-opus-5")).toEqual({
      aiSummary: request.summary,
      aiKind: "LETTER",
      aiStyle: "MILITARY",
      aiLanguage: "nl",
      aiModel: "claude-opus-5",
    });
  });

  it("calls an AI document by the kind the user chose", () => {
    expect(aiKindLabel(AI_DRAFT_TYPE, { aiKind: "MEMO" })).toBe("Memorandum");
    expect(docTypeLabel(AI_DRAFT_TYPE, { aiKind: "NOTICE" })).toBe("Notice");
    expect(docTypeLabel(AI_DRAFT_TYPE, {})).toBe("Document written with AI");
    expect(docTypeLabel("poa", { aiKind: "MEMO" })).toBe("Power of Attorney");
  });

  it("is a known type for saving and printing, but not a template in the picker", () => {
    expect(catalogueEntry(AI_DRAFT_TYPE)).toBe(AI_DRAFT_ENTRY);
    expect(CATALOGUE.some((e) => e.key === AI_DRAFT_TYPE)).toBe(false);
    expect(catalogueByCategory().flatMap((g) => g.entries).some((e) => e.key === AI_DRAFT_TYPE)).toBe(false);
  });

  it("passes the save gate like any other document", () => {
    const res = parseGeneralDocumentInput({
      docType: AI_DRAFT_TYPE,
      title: "Uitstel storten dakvloer",
      body: ["1. Het storten is uitgesteld."],
      values: draftValues(request, "claude-opus-5"),
    });
    expect(res.ok).toBe(true);
  });
});

describe("issuing an AI document", () => {
  it("refuses while a blank is left in the wording", () => {
    expect(hasBlank(["1. Nieuwe datum: __________."])).toBe(true);
    expect(issueBlockers(AI_DRAFT_TYPE, {}, ["1. Nieuwe datum: __________."])).toEqual([
      "the blanks (__________) the AI left in the wording",
    ]);
  });

  it("issues once the blanks are filled", () => {
    expect(issueBlockers(AI_DRAFT_TYPE, {}, ["1. Nieuwe datum: 14 OCT 2026."])).toEqual([]);
  });

  it("leaves the templates' own rules alone — they print a rule for an optional field on purpose", () => {
    const poaValues = { principalName: "A", attorneyName: "B", scope: "C" };
    expect(issueBlockers("poa", poaValues, ["Signed at ____ on ____."])).toEqual([]);
  });
});
