/**
 * The sample set as data: what it contains, how it is marked, and that every
 * stored figure agrees with the app's own calculators. Pure; no database.
 * (What a run does to a real database is checked by the integration script
 * described in the pull request.)
 */
import { describe, expect, it } from "vitest";
import {
  SAMPLE_CHILD_MODELS,
  SAMPLE_MODEL_ORDER,
  SAMPLE_MODULES,
  buildSampleSet,
  moduleCounts,
  planIds,
  rowCounts,
  sampleNumber,
  sampleToken,
  totalRows,
  type SampleLang,
  type SampleModel,
  type SamplePlan,
} from "./build";
import { nextInvoiceNumber, nextCreditNoteNumber, invoiceTotals } from "@/lib/finance/calc";
import { nextProposalNumber } from "@/lib/proposals/persist";
import { nextPermitReference } from "@/lib/building-permits/register";
import { nextDocumentNumber } from "@/lib/general-documents/render";
import { computeProposal } from "@/lib/proposals/engine/engine";
import { poTotals } from "@/lib/procurement/calc";
import type { PurchaseOrderLine } from "@/lib/procurement/types";
import { parseContractBody, parseContractFacts } from "@/lib/contracts/schema";
import { catalogueEntry } from "@/lib/general-documents/catalogue";
import { requiredMissing } from "@/lib/general-documents/render";
import { computeCpm } from "@/lib/data/schedule";
import { deriveProjectProgress } from "@/lib/projects/phases";

const TODAY = new Date("2026-10-11T15:30:00Z");

function build(lang: SampleLang, over: Partial<Parameters<typeof buildSampleSet>[0]> = {}): SamplePlan {
  let n = 0;
  return buildSampleSet({
    companyId: "cmpanyaaaaaaaaaaaaab12cd",
    companyName: "Test Practice",
    token: "AB12CD",
    lang,
    currency: "AWG",
    owner: { id: "user-1", name: "Olivia Owner" },
    today: TODAY,
    newId: () => `id-${++n}`,
    ...over,
  });
}

const rows = (plan: SamplePlan, model: SampleModel) => plan[model] as unknown as Record<string, unknown>[];
const en = build("en");
const es = build("es");

describe("what the sample set contains", () => {
  it("one finished record (or a small set) in every covered module", () => {
    expect(moduleCounts(planIds(en))).toEqual({
      clients: 1,
      projects: 1,
      serviceProposals: 1,
      estimates: 1,
      schedule: 1,
      tasks: 8,
      meetings: 1,
      permits: 1,
      constructionAdmin: 11,
      procurement: 1,
      materials: 4,
      deliverables: 8,
      generalDocuments: 1,
      contracts: 1,
      invoices: 1,
      time: 2,
      expenses: 1,
    });
    expect(totalRows(en)).toBe(141);
  });

  it("is complete where a stub was not: sections, lines, phases, milestones, a chain of tasks", () => {
    const c = rowCounts(en);
    expect(c.estimateCategory).toBe(5);
    expect(c.estimateItem).toBe(22);
    expect(c.scheduleTask).toBe(15);
    expect(c.projectPhase).toBe(7);
    expect(c.serviceProposalFeeComponent).toBe(4);
    expect(c.serviceProposalPaymentMilestone).toBe(4);
    expect(c.buildingPermitSubmission).toBe(2);
    expect(c.actionItem).toBe(4);
    expect(c.invoiceLine).toBe(3);
    expect(c.invoicePayment).toBe(1);
  });

  it("every module in the list names models the plan really has", () => {
    for (const m of SAMPLE_MODULES) for (const model of m.models) expect(SAMPLE_MODEL_ORDER).toContain(model);
  });

  it("English and Spanish are the same structure: same rows, same keys, same numbers", () => {
    expect(rowCounts(es)).toEqual(rowCounts(en));
    for (const model of SAMPLE_MODEL_ORDER) {
      const a = rows(en, model);
      const b = rows(es, model);
      a.forEach((row, i) => {
        expect({ model, keys: Object.keys(b[i]).sort() }).toEqual({ model, keys: Object.keys(row).sort() });
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === "number") expect({ model, k, v: b[i][k] }).toEqual({ model, k, v });
        }
      });
    }
  });

  it("the Spanish set is really in Spanish", () => {
    expect(String(rows(es, "project")[0].name)).toContain("vivienda unifamiliar");
    expect(String(rows(es, "meetingMinute")[0].summary)).toContain("cimentación");
    expect(String(rows(en, "project")[0].name)).toContain("single-family house");
  });
});

describe("tenancy and identity", () => {
  it("every row of a company-owned model carries the company id", () => {
    for (const model of SAMPLE_MODEL_ORDER) {
      if (SAMPLE_CHILD_MODELS.has(model)) continue;
      for (const row of rows(en, model)) expect({ model, companyId: row.companyId }).toEqual({ model, companyId: "cmpanyaaaaaaaaaaaaab12cd" });
    }
  });

  it("every row has an id, unique across the set (the estimate shares its project's id by design)", () => {
    const all = SAMPLE_MODEL_ORDER.flatMap((m) => rows(en, m).map((r) => `${r.id}`));
    expect(all.every((id) => id && id !== "undefined")).toBe(true);
    const projectId = rows(en, "project")[0].id;
    expect(rows(en, "costEstimate")[0].id).toBe(projectId);
    const withoutEstimate = SAMPLE_MODEL_ORDER.filter((m) => m !== "costEstimate").flatMap((m) => rows(en, m).map((r) => `${r.id}`));
    expect(new Set(withoutEstimate).size).toBe(withoutEstimate.length);
  });

  it("every reference inside the set points at a row of the set", () => {
    const ids = new Set(SAMPLE_MODEL_ORDER.flatMap((m) => rows(en, m).map((r) => String(r.id))));
    const refs = ["clientId", "projectId", "serviceProposalId", "permitId", "meetingId", "invoiceId", "invoiceLineId", "estimateId", "categoryId", "scheduleId", "phaseId", "purchaseOrderId", "milestoneId", "dependentId", "requiredId"];
    for (const model of SAMPLE_MODEL_ORDER) {
      for (const row of rows(en, model)) {
        for (const ref of refs) {
          const v = row[ref];
          if (typeof v === "string") expect({ model, ref, ok: ids.has(v) }).toEqual({ model, ref, ok: true });
        }
      }
    }
  });

  it("people are assigned to the owner, and nobody else is invented as a user", () => {
    for (const row of rows(en, "task")) expect(row.assigneeId).toBe("user-1");
    for (const row of rows(en, "actionItem")) expect(row.assigneeId).toBe("user-1");
    expect(rows(en, "project")[0].managerId).toBe("user-1");
    expect(SAMPLE_MODEL_ORDER).not.toContain("user" as SampleModel);
  });

  it("no address could reach a real inbox", () => {
    const text = JSON.stringify(en);
    const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/@example\.(com|net|org)$/);
  });
});

describe("how a sample is marked", () => {
  const named: [SampleModel, string][] = [
    ["client", "name"],
    ["project", "name"],
    ["serviceProposal", "title"],
    ["task", "title"],
    ["meetingMinute", "title"],
    ["buildingPermit", "title"],
    ["changeOrder", "title"],
    ["rfiLog", "subject"],
    ["siteInstruction", "title"],
    ["submittalLog", "title"],
    ["delayNotice", "title"],
    ["punchListItem", "description"],
    ["purchaseOrder", "vendorName"],
    ["materialSelection", "productName"],
    ["designDeliverable", "title"],
    ["generalDocument", "title"],
    ["invoice", "title"],
    ["timeEntry", "description"],
    ["expense", "description"],
    ["costEstimate", "projectName"],
    ["projectSchedule", "projectName"],
    ["constructionContract", "projectName"],
    ["caReport", "projectName"],
    ["progressCertification", "projectName"],
  ];

  it("every name starts with SAMPLE, and with EJEMPLO in the Spanish set", () => {
    for (const [model, field] of named) {
      for (const row of rows(en, model)) expect({ model, v: String(row[field]).startsWith("SAMPLE - ") }).toEqual({ model, v: true });
      for (const row of rows(es, model)) expect({ model, v: String(row[field]).startsWith("EJEMPLO - ") }).toEqual({ model, v: true });
    }
  });

  const numbered: [SampleModel, string][] = [
    ["project", "projectNumber"],
    ["serviceProposal", "number"],
    ["buildingPermit", "reference"],
    ["caReport", "reportNumber"],
    ["changeOrder", "changeOrderNumber"],
    ["rfiLog", "rfiNumber"],
    ["siteInstruction", "instructionNumber"],
    ["submittalLog", "submittalNumber"],
    ["delayNotice", "delayNoticeNumber"],
    ["progressCertification", "certificationNumber"],
    ["punchListItem", "itemNumber"],
    ["purchaseOrder", "poNumber"],
    ["materialSelection", "tag"],
    ["generalDocument", "number"],
    ["constructionContract", "number"],
    ["invoice", "number"],
  ];

  it("every number is on the SMP series with the company token, and ends in a letter", () => {
    for (const [model, field] of numbered) {
      for (const row of rows(en, model)) {
        const n = String(row[field]);
        expect({ model, n, ok: /^SMP-AB12CD-[A-Z]+-[A-Z]$/.test(n) }).toEqual({ model, n, ok: true });
        // The rule every allocator in the app applies: trailing digits, plus one.
        expect({ model, n, counted: /(\d+)\s*$/.test(n) }).toEqual({ model, n, counted: false });
      }
    }
  });

  it("numbers within the set never repeat", () => {
    for (const [model, field] of numbered) {
      const list = rows(en, model).map((r) => String(r[field]));
      expect(new Set(list).size).toBe(list.length);
    }
    const deliverables = rows(en, "designDeliverable").map((r) => String(r.number));
    expect(new Set(deliverables).size).toBe(deliverables.length);
    expect(deliverables.every((n) => n.startsWith("SMP-"))).toBe(true);
  });

  it("the app's own allocators give the same next number with and without the sample", () => {
    const year = 2026;
    const inv = String(rows(en, "invoice")[0].number);
    expect(nextInvoiceNumber(["INV-2026-004", inv], year)).toBe(nextInvoiceNumber(["INV-2026-004"], year));
    expect(nextInvoiceNumber([inv], year)).toBe("INV-2026-001");
    expect(nextCreditNoteNumber([inv], year)).toBe("CN-2026-001");
    expect(nextProposalNumber([String(rows(en, "serviceProposal")[0].number)], year)).toBe(nextProposalNumber([], year));
    expect(nextPermitReference([String(rows(en, "buildingPermit")[0].reference)], year)).toBe(nextPermitReference([], year));
    expect(nextDocumentNumber([String(rows(en, "generalDocument")[0].number)], year)).toBe(nextDocumentNumber([], year));
  });

  it("the token is the company's own tail, and a number built from it ends in a letter", () => {
    expect(sampleToken("cmv3fvbyo000el0viopg7hzbb")).toBe("G7HZBB");
    expect(sampleToken("ab")).toBe("0000AB");
    expect(sampleNumber("G7HZBB", "INV")).toBe("SMP-G7HZBB-INV-A");
    // The old signup stub used SMP-<5 chars>-01: a different shape, so no clash.
    expect(/^SMP-[A-Z0-9]{5}-0[12]$/.test(sampleNumber("G7HZBB", "PRJ"))).toBe(false);
  });
});

describe("every stored figure agrees with the app's own calculator", () => {
  it("service proposal: header totals and child amounts are the engine's", () => {
    const sp = rows(en, "serviceProposal")[0];
    const version = rows(en, "serviceProposalVersion")[0].snapshot as { input: Parameters<typeof computeProposal>[0]; calc: { totals: { grandTotal: number } } };
    const calc = computeProposal(version.input);
    expect(calc.errors ?? []).toEqual([]);
    expect(sp.grandTotal).toBe(calc.totals.grandTotal);
    expect(sp.subtotal).toBe(calc.totals.subtotal);
    expect(sp.taxTotal).toBe(calc.totals.taxTotal);
    expect(sp.discountTotal).toBe(calc.totals.discountTotal);
    expect(Number(sp.grandTotal)).toBeGreaterThan(30000);
    const milestones = rows(en, "serviceProposalPaymentMilestone");
    const sum = milestones.reduce((s, m) => s + Number(m.amount), 0);
    expect(Math.round(sum * 100)).toBe(Math.round(Number(sp.grandTotal) * 100));
    expect(milestones.reduce((s, m) => s + Number(m.percent), 0)).toBe(100);
    expect(rows(en, "serviceProposalPhase").reduce((s, p) => s + Number(p.percent), 0)).toBe(100);
    // The optional service is offered, not counted.
    const optional = rows(en, "serviceProposalFeeComponent").find((c) => c.category === "OPTIONAL");
    expect(optional?.selected).toBe(false);
    expect(sp.status).toBe("ACCEPTED");
    expect(rows(en, "project")[0].contractValue).toBe(sp.grandTotal);
  });

  it("estimate: the stored amount is the rounded grand total of its own lines", () => {
    const est = rows(en, "costEstimate")[0];
    const items = rows(en, "estimateItem");
    const direct = items.reduce((s, it) => {
      const qty = Number(it.qty);
      return s + qty * Number(it.laborNorm) * Number(est.avgLaborRate) + qty * (Number(it.materialUnitCost) + Number(it.equipmentUnitCost) + Number(it.subcontractUnitCost));
    }, 0);
    const grand = direct * (1 + (Number(est.profitPct) + Number(est.bboPct)) / 100);
    expect(est.amount).toBe(Math.round(grand));
    expect(Number(est.amount)).toBeGreaterThan(200000);
    // Every cost column and the progress column show real numbers somewhere.
    for (const col of ["laborNorm", "materialUnitCost", "equipmentUnitCost", "subcontractUnitCost", "poc"]) {
      expect({ col, some: items.some((it) => Number(it[col]) > 0) }).toEqual({ col, some: true });
    }
    expect(items.every((it) => Number(it.poc) >= 0 && Number(it.poc) <= 100)).toBe(true);
  });

  it("schedule: a real dependency chain with a critical path through it", () => {
    const tasks = rows(en, "scheduleTask").map((t) => ({ id: String(t.taskKey), start: String(t.start), end: String(t.end), dependsOn: t.dependsOn as string[] }));
    const keys = new Set(tasks.map((t) => t.id));
    for (const t of tasks) {
      for (const d of t.dependsOn) expect(keys.has(d)).toBe(true);
      expect(t.start <= t.end).toBe(true);
      expect(t.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const cpm = computeCpm(tasks);
    const critical = tasks.filter((t) => cpm.critical.has(t.id));
    expect(critical.length).toBeGreaterThanOrEqual(5);
    expect(critical.length).toBeLessThan(tasks.length);
    const statuses = new Set(rows(en, "scheduleTask").map((t) => t.status));
    expect([...statuses].sort()).toEqual(["COMPLETED", "IN_PROGRESS", "NOT_STARTED"]);
  });

  it("project: progress is derived from its phases", () => {
    const phases = rows(en, "projectPhase").map((p) => ({ status: String(p.status), progressPct: Number(p.progressPct) }));
    expect(rows(en, "project")[0].progressPct).toBe(deriveProjectProgress(phases));
  });

  it("invoice: totals are the calculator's, and it is paid in full so it is never outstanding", () => {
    const inv = rows(en, "invoice")[0];
    const lines = rows(en, "invoiceLine");
    const t = invoiceTotals(lines.map((l) => ({ amount: Number(l.amount), taxable: true })), { percent: Number(inv.taxPercent), mode: "EXCLUSIVE" }, "AWG");
    expect({ subtotal: inv.subtotal, taxableSubtotal: inv.taxableSubtotal, taxTotal: inv.taxTotal, total: inv.total }).toEqual(t);
    expect(rows(en, "invoicePayment")[0].amount).toBe(inv.total);
    // Never store PAID: the app derives it from the payment.
    expect(inv.status).toBe("ISSUED");
    // The first line bills the proposal's first payment milestone.
    const m = rows(en, "serviceProposalPaymentMilestone")[0];
    expect(lines[0].milestoneId).toBe(m.id);
    // Before tax: the milestone is a share of the grand total, tax included, so
    // the line carries it net and the invoice adds the tax once. Line plus tax
    // is the milestone the client accepted, not the milestone plus tax again.
    const rate = Number(inv.taxPercent) / 100;
    expect(Number(lines[0].amount)).toBeLessThan(Number(m.amount));
    expect(Math.abs(Number(lines[0].amount) * (1 + rate) - Number(m.amount))).toBeLessThan(0.011);
    expect(inv.serviceProposalId).toBe(rows(en, "serviceProposal")[0].id);
    expect(String(inv.taxName)).toContain("SAMPLE");
  });

  it("time and expense on the invoice are stamped as billed, so they are never offered as unbilled work", () => {
    const inv = rows(en, "invoice")[0];
    const billable = [...rows(en, "timeEntry"), ...rows(en, "expense")].filter((r) => r.billable === true);
    expect(billable.length).toBe(2);
    for (const r of billable) {
      expect(r.status).toBe("APPROVED");
      expect(r.invoiceId).toBe(inv.id);
      expect(r.invoiceNumber).toBe(inv.number);
      expect(r.invoicedAt).toBeInstanceOf(Date);
    }
    const expense = rows(en, "expense")[0];
    expect(expense.receiptStorageKey).toBeUndefined();
  });

  it("purchase order: totals are the calculator's and the receipt is partial", () => {
    const po = rows(en, "purchaseOrder")[0];
    const lines = po.lineItems as PurchaseOrderLine[];
    const t = poTotals({ lineItems: lines, taxPercentage: Number(po.taxPercentage), shipping: Number(po.shipping) });
    expect({ subtotal: po.subtotal, total: po.total }).toEqual({ subtotal: t.subtotal, total: t.total });
    expect(po.status).toBe("PARTIAL");
    expect(lines.some((l) => (l.receivedQty ?? 0) === l.quantity)).toBe(true);
    expect(lines.some((l) => (l.receivedQty ?? 0) > 0 && (l.receivedQty ?? 0) < l.quantity)).toBe(true);
    expect(lines.some((l) => (l.receivedQty ?? 0) === 0)).toBe(true);
    const linked = rows(en, "materialSelection").filter((m) => m.purchaseOrderId === po.id);
    expect(linked.length).toBe(2);
    expect(linked.every((m) => m.status === "ORDERED")).toBe(true);
    expect(rows(en, "scheduleTask").some((t) => t.taskKey === po.scheduleTaskKey)).toBe(true);
  });

  it("change order and payment certificate: the derived figures add up", () => {
    const co = rows(en, "changeOrder")[0];
    expect(Number(co.totalCost)).toBeCloseTo((2400 + 5200 + 600) * 1.08 * 1.1, 2);
    expect(co.revisedContractValue).toBe(Math.round((480000 + Number(co.totalCost)) * 100) / 100);
    const pc = rows(en, "progressCertification")[0];
    expect(pc.workCompletedValue).toBe(105600);
    expect(pc.retentionAmount).toBe(5280);
    expect(pc.amountRecommendedForPayment).toBe(100320);
  });

  it("contract: facts and body pass the app's own schemas, and the instalments total the sum", () => {
    const c = rows(en, "constructionContract")[0];
    const facts = parseContractFacts(c.facts);
    const body = parseContractBody(c.body);
    expect(facts.ok).toBe(true);
    expect(body.ok).toBe(true);
    const schedule = (c.body as { schedule: { amountAwg: number; percent: number }[] }).schedule;
    expect(schedule.reduce((s, r) => s + r.percent, 0)).toBe(100);
    expect(Math.round(schedule.reduce((s, r) => s + r.amountAwg, 0))).toBe(480000);
    expect(c.templateId).toBeUndefined();
  });

  it("general document: a catalogue type with every required field filled", () => {
    const d = rows(en, "generalDocument")[0];
    const entry = catalogueEntry(String(d.docType));
    expect(entry).toBeTruthy();
    expect(requiredMissing(entry!, d.values as Record<string, string>)).toEqual([]);
    expect((d.body as string[]).length).toBeGreaterThanOrEqual(4);
    expect((d.body as string[]).join(" ")).not.toContain("__________");
  });
});

describe("it never looks stale, and never raises an alarm", () => {
  it("every date is relative to today", () => {
    const later = build("en", { today: new Date(TODAY.getTime() + 10 * 86_400_000) });
    const shift = (a: unknown, b: unknown) => ((b as Date).getTime() - (a as Date).getTime()) / 86_400_000;
    expect(shift(rows(en, "invoice")[0].issueDate, rows(later, "invoice")[0].issueDate)).toBe(10);
    expect(shift(rows(en, "project")[0].targetEndDate, rows(later, "project")[0].targetEndDate)).toBe(10);
    expect(shift(rows(en, "task")[2].dueDate, rows(later, "task")[2].dueDate)).toBe(10);
  });

  it("dates are whole UTC days, whatever time of day the install runs", () => {
    expect((rows(en, "invoice")[0].issueDate as Date).toISOString()).toBe("2026-09-17T00:00:00.000Z");
    const lateNight = build("en", { today: new Date("2026-10-11T23:59:59Z") });
    expect((rows(lateNight, "invoice")[0].issueDate as Date).toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("the project is not late and the permit is a closed case with no open deadline", () => {
    expect((rows(en, "project")[0].targetEndDate as Date).getTime()).toBeGreaterThan(TODAY.getTime() + 150 * 86_400_000);
    const permit = rows(en, "buildingPermit")[0];
    expect(permit.status).toBe("ISSUED");
    expect(permit.revisionDueAt).toBeUndefined();
    for (const d of rows(en, "buildingPermitDeadline")) expect(d.metAt).toBeInstanceOf(Date);
    for (const l of rows(en, "buildingPermitCorrespondence")) {
      if (l.requiresResponse) expect(l.respondedAt).toBeInstanceOf(Date);
    }
  });

  it("tasks are a spread: every status, every priority, done and still to do", () => {
    const tasks = rows(en, "task");
    expect([...new Set(tasks.map((t) => t.status))].sort()).toEqual(["DONE", "IN_PROGRESS", "TODO"]);
    expect([...new Set(tasks.map((t) => t.priority))].sort()).toEqual(["CRITICAL", "HIGH", "LOW", "MEDIUM"]);
    expect(tasks.every((t) => t.dueDate instanceof Date)).toBe(true);
    expect(tasks.some((t) => t.kind === "REMINDER")).toBe(true);
  });

  it("no row pretends to hold a file", () => {
    const text = JSON.stringify(en);
    expect(text).not.toContain("storageKey");
    for (const d of rows(en, "designDeliverable")) expect(d.fileLink).toBeUndefined();
    expect(SAMPLE_MODEL_ORDER).not.toContain("drawing" as SampleModel);
    expect(SAMPLE_MODEL_ORDER).not.toContain("buildingPermitDocument" as SampleModel);
    expect(SAMPLE_MODEL_ORDER).not.toContain("contractTemplate" as SampleModel);
  });
});
