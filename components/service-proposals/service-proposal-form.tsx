"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { computeProposal } from "@/lib/proposals/engine/engine";
import {
  COST_BASIS_LABEL,
  DEFAULT_PHASES,
  FEE_METHOD_LABEL,
  RATE_METHODS,
  LUMP_METHODS,
  MARKUP_METHODS,
  RATE_METHOD_UNIT,
  type CostBasisType,
  type FeeMethod,
  type ProposalCalcInput,
  type ServiceCategory,
} from "@/lib/proposals/engine/types";
import type { ServiceProposalDTO } from "@/lib/proposals/dto";
import { PROPOSAL_TEMPLATES, getTemplate } from "@/lib/proposals/templates";
import {
  createServiceProposalAction,
  updateServiceProposalAction,
} from "@/app/(app)/design/service-proposals/actions";
import { saveClient } from "@/app/(app)/clients/actions";
import type { ClientWriteInput } from "@/lib/data/clients.types";
import { saveProject } from "@/app/(app)/projects/actions";

type Option = { id: string; name: string };

/** Sentinel value for the "+ New client" row in the client dropdown. Never sent to the server. */
const NEW_CLIENT = "__new_client__";
/** Sentinel for the "+ New project" row — never submitted as a project id. */
const NEW_PROJECT = "__new_project__";

const CURRENCIES = ["USD", "AWG", "EUR", "ANG"];
const BASIS_TYPES: CostBasisType[] = [
  "ESTIMATED_CONSTRUCTION_COST",
  "APPROVED_CONSTRUCTION_BUDGET",
  "CONTRACTOR_CONTRACT_SUM",
  "TOTAL_DEVELOPMENT_COST",
  "CUSTOM",
];

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";
/** Applied on top of `field` when the server rejected that input. */
const fieldInvalid = "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20";

/* ---- Server-side validation issues ------------------------------------- */

/**
 * A rejected field, rewritten for this form.
 *
 * The server validates the payload, so its issue paths carry payload array indexes
 * (`phases.4.name`). Rows here are keyed by a stable `uid()`, and two of the payload
 * arrays are filtered before they are sent, so index ≠ render position. `mapIssues`
 * rewrites the index to the row key it came from — `path` is therefore
 * `phases.<rowKey>.name` and the JSX can look an issue up without re-deriving the
 * payload order. `label` is a human location so every message can be listed in the
 * summary, including ones for inputs this form does not render.
 */
type FieldIssue = { path: string; message: string; label: string };

/** Payload-array name → the row keys that were sent, in payload order. */
type RowKeyMap = Record<string, string[]>;

/** Tax and discount are single fixed rows rather than a repeater, so they get fixed keys. */
const TAX_KEY = "tax";
const DISCOUNT_KEY = "discount";

/**
 * Is this phase / milestone row worth sending?
 *
 * "Add phase" and "Add milestone" insert a blank row. A user who adds one and then thinks
 * better of it leaves an empty row behind, and the schema requires a name — which rejected
 * the whole proposal over a row the user had already abandoned. Blank rows are dropped the
 * same way blank reimbursables and scope items already are. A row with a percentage but no
 * name is still sent, so that genuine mistake is reported rather than silently discarded.
 */
const isUsedRow = (r: { name: string; percent: string }) => r.name.trim() !== "" || Number(r.percent) > 0;

const GROUP_LABEL: Record<string, string> = {
  feeComponents: "Professional fees",
  phases: "Design phases",
  paymentMilestones: "Payment schedule",
  reimbursables: "Reimbursable expenses",
  scopeItems: "Scope of services",
  taxes: "Tax",
  discounts: "Discount",
  costBasis: "Cost basis",
};

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  currency: "Currency",
  contactName: "Contact name",
  contactEmail: "Contact email",
  clientName: "Client",
  projectName: "Project",
  amount: "Amount",
  label: "Description",
  name: "Name",
  percent: "Percentage",
  fixedAmount: "Amount",
  quantity: "Quantity",
  unitRate: "Rate",
  baseAmount: "Base cost",
  markupPercent: "Markup %",
  value: "Value",
  scopeSummary: "Scope summary",
  exclusions: "Exclusions",
  assumptions: "Assumptions",
  terms: "Terms & conditions",
  validUntil: "Valid until",
};

const humanField = (segment: string) => FIELD_LABEL[segment] ?? segment;

/**
 * Rewrite server issue paths from payload indexes to stable row keys, and build a
 * readable location for each one. Anything that does not match the row-keyed shape is
 * passed through untouched so it still reaches the summary.
 */
function mapIssues(
  raw: { path: string; message: string }[],
  keys: RowKeyMap,
): FieldIssue[] {
  return raw.map((issue) => {
    const [group, second, ...rest] = issue.path.split(".");
    const rowKeys = keys[group];
    const index = Number(second);
    if (rowKeys && Number.isInteger(index) && rowKeys[index] !== undefined) {
      const leaf = rest.join(".");
      return {
        path: [group, rowKeys[index], leaf].filter(Boolean).join("."),
        message: issue.message,
        label: `${GROUP_LABEL[group] ?? group} — line ${index + 1}${leaf ? ` — ${humanField(leaf)}` : ""}`,
      };
    }
    if (group === "costBasis") {
      return {
        path: issue.path,
        message: issue.message,
        label: `${GROUP_LABEL.costBasis}${second ? ` — ${humanField(second)}` : ""}`,
      };
    }
    return { path: issue.path, message: issue.message, label: humanField(group) };
  });
}

type FeeRow = {
  key: string;
  label: string;
  method: FeeMethod;
  percent: string;
  fixedAmount: string;
  quantity: string;
  unitRate: string;
  baseAmount: string;
  markupPercent: string;
  category: ServiceCategory;
  selected: boolean;
};
type PhaseRow = { key: string; name: string; percent: string };
type MilestoneRow = { key: string; name: string; percent: string };
type ReimbRow = { key: string; label: string; amount: string };
type WorksheetRow = { key: string; category: string; amount: string; included: boolean; isProfFees: boolean };
type ScopeRow = { key: string; title: string; description: string; included: boolean };

let counter = 0;
const uid = () => `r${counter++}`;

/** Fee methods offered in the form, grouped for the dropdown. */
const FEE_METHOD_ORDER: FeeMethod[] = [
  "PERCENT_OF_BASIS",
  "FIXED",
  "HOURLY",
  "PER_AREA",
  "PER_UNIT",
  "PER_DELIVERABLE",
  "MONTHLY",
  "RETAINER",
  "MILESTONE",
  "COST_PLUS",
  "SUBCONSULTANT_PLUS_MARKUP",
];

const emptyFee = (): FeeRow => ({
  key: uid(),
  label: "",
  method: "PERCENT_OF_BASIS",
  percent: "",
  fixedAmount: "",
  quantity: "",
  unitRate: "",
  baseAmount: "",
  markupPercent: "",
  category: "BASE",
  selected: false,
});

export function ServiceProposalForm({
  clients,
  projects,
  mode,
  initial,
}: {
  clients: Option[];
  projects: Option[];
  mode: "new" | "edit";
  initial?: ServiceProposalDTO;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const nav = useRef<HTMLDivElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  /** The message for an input, or undefined when it was accepted. */
  const issueFor = (path: string) => issues.find((i) => i.path === path)?.message;

  // Take the user to the first rejected input. The form is long and the error banner sits
  // at the bottom, so without this a rejection off-screen looks like nothing happened.
  useEffect(() => {
    if (issues.length === 0) return;
    const first = nav.current?.querySelector<HTMLElement>("[data-invalid='true']");
    const target = first ?? errorBox.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    first?.focus({ preventScroll: true });
  }, [issues]);

  const init = initial?.input;

  const [title, setTitle] = useState(init?.title ?? "");
  const [clientId, setClientId] = useState(init?.clientId ?? "");
  const [projectId, setProjectId] = useState(init?.projectId ?? "");
  const [contactName, setContactName] = useState(init?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(init?.contactEmail ?? "");
  const [currency, setCurrency] = useState(init?.currency ?? "USD");

  /* ---- Inline "+ New client" -------------------------------------------- */
  // Clients created from inside this form. Merged with the server-rendered list
  // so the new row is selectable immediately, without leaving the page.
  const [addedClients, setAddedClients] = useState<Option[]>([]);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [clientPending, startClient] = useTransition();

  const clientOptions = useMemo(() => {
    const known = new Set(clients.map((c) => c.id));
    return [...clients, ...addedClients.filter((c) => !known.has(c.id))];
  }, [clients, addedClients]);

  function resetNewClient() {
    setNewClientName("");
    setNewClientCompany("");
    setNewClientEmail("");
    setNewClientError(null);
  }

  function onClientChange(value: string) {
    if (value === NEW_CLIENT) {
      setNewClientError(null);
      setNewClientOpen(true);
      return;
    }
    setNewClientOpen(false);
    resetNewClient();
    setClientId(value);
  }

  /** Cancel the inline form — the dropdown falls back to whatever was selected before. */
  function cancelNewClient() {
    setNewClientOpen(false);
    resetNewClient();
  }

  /* ---- Inline "+ New project" ------------------------------------------- */
  const [addedProjects, setAddedProjects] = useState<Option[]>([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectAddress, setNewProjectAddress] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [projectPending, startProject] = useTransition();

  const projectOptions = useMemo(() => {
    const known = new Set(projects.map((p) => p.id));
    return [...projects, ...addedProjects.filter((p) => !known.has(p.id))];
  }, [projects, addedProjects]);

  function resetNewProject() {
    setNewProjectName("");
    setNewProjectAddress("");
    setNewProjectError(null);
  }

  function onProjectChange(value: string) {
    if (value === NEW_PROJECT) {
      setNewProjectError(null);
      setNewProjectOpen(true);
      return;
    }
    setNewProjectOpen(false);
    resetNewProject();
    setProjectId(value);
  }

  function cancelNewProject() {
    setNewProjectOpen(false);
    resetNewProject();
  }

  function saveNewProject() {
    const name = newProjectName.trim();
    if (!name) {
      setNewProjectError("Project name is required.");
      return;
    }
    // createProject resolves the client by NAME and throws when it finds none,
    // so refuse here with something actionable rather than letting the server
    // return "Client not found".
    const client = clientOptions.find((c) => c.id === clientId);
    if (!client) {
      setNewProjectError("Choose a client first — a project must belong to one.");
      return;
    }
    setNewProjectError(null);

    startProject(async () => {
      // The same server action /projects/new uses, so numbering, the standard
      // phase set, tenant scoping and activity logging all stay in one place.
      // `manager` is left empty deliberately: resolveManagerId falls back to the
      // most senior user, and asking for a manager here would be a second form.
      const res = await saveProject("new", {
        name,
        clientName: client.name,
        manager: "",
        siteAddress: newProjectAddress.trim() || null,
        currency,
      });
      if (!res.ok) {
        setNewProjectError(res.error);
        return;
      }
      setAddedProjects((p) => [...p, { id: res.id, name }]);
      setProjectId(res.id);
      setNewProjectOpen(false);
      resetNewProject();
    });
  }

  function saveNewClient() {
    const name = newClientName.trim();
    if (!name) {
      setNewClientError("Client name is required.");
      return;
    }
    setNewClientError(null);
    // Same server action the /clients/new form uses, so tenant scoping,
    // validation and activity logging all stay in one place.
    const payload: ClientWriteInput = {
      name,
      companyName: newClientCompany.trim() || null,
      contactPerson: null,
      email: newClientEmail.trim() || null,
      phone: null,
      website: null,
      taxNumber: null,
      type: "PRIVATE",
      status: "ACTIVE",
      tags: [],
      notes: null,
      addresses: [],
    };
    startClient(async () => {
      const res = await saveClient("new", payload);
      if (!res.ok) {
        setNewClientError(res.error);
        return;
      }
      setAddedClients((p) => [...p, { id: res.id, name }]);
      setClientId(res.id);
      setNewClientOpen(false);
      resetNewClient();
    });
  }

  // Enter inside the inline fields must save the client, not submit the proposal.
  function onNewClientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveNewClient();
  }

  /** Enter inside the inline project fields saves the project, not the proposal. */
  function onNewProjectKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    saveNewProject();
  }

  const [basisType, setBasisType] = useState<CostBasisType>(
    init?.costBasis?.type ?? "ESTIMATED_CONSTRUCTION_COST",
  );
  const [basisAmount, setBasisAmount] = useState(String(init?.costBasis?.amount ?? ""));
  const [basisSourceField, setBasisSourceField] = useState(init?.costBasis?.sourceField ?? "");
  const [worksheet, setWorksheet] = useState<WorksheetRow[]>(
    init?.costBasis?.worksheet?.length
      ? init.costBasis.worksheet.map((w) => ({
          key: uid(),
          category: w.category,
          amount: String(w.amount),
          included: w.includedInBasis,
          isProfFees: w.isProfessionalFees ?? false,
        }))
      : [],
  );

  const [fees, setFees] = useState<FeeRow[]>(
    init?.feeComponents?.length
      ? init.feeComponents.map((c) => ({
          key: uid(),
          label: c.label,
          method: c.method,
          percent: c.percent != null ? String(c.percent) : "",
          fixedAmount: c.fixedAmount != null ? String(c.fixedAmount) : "",
          quantity: c.quantity != null ? String(c.quantity) : "",
          unitRate: c.unitRate != null ? String(c.unitRate) : "",
          baseAmount: c.baseAmount != null ? String(c.baseAmount) : "",
          markupPercent: c.markupPercent != null ? String(c.markupPercent) : "",
          category: c.category,
          selected: c.selected ?? false,
        }))
      : [{ ...emptyFee(), label: "Architectural design services" }],
  );

  const [phases, setPhases] = useState<PhaseRow[]>(
    init?.phases?.length
      ? init.phases.map((p) => ({ key: uid(), name: p.name, percent: String(p.percent) }))
      : DEFAULT_PHASES.map((p) => ({ key: uid(), name: p.name, percent: String(p.percentage) })),
  );

  const [milestones, setMilestones] = useState<MilestoneRow[]>(
    init?.paymentMilestones?.length
      ? init.paymentMilestones.map((m) => ({ key: uid(), name: m.name, percent: String(m.percent) }))
      : [],
  );

  const [reimb, setReimb] = useState<ReimbRow[]>(
    init?.reimbursables?.length
      ? init.reimbursables.map((r) => ({ key: uid(), label: r.label, amount: String(r.amount) }))
      : [],
  );

  const [taxName, setTaxName] = useState(init?.taxes?.[0]?.name ?? "");
  const [taxPercent, setTaxPercent] = useState(String(init?.taxes?.[0]?.percent ?? ""));

  const [discountLabel, setDiscountLabel] = useState(init?.discounts?.[0]?.label ?? "");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(init?.discounts?.[0]?.type ?? "PERCENT");
  const [discountValue, setDiscountValue] = useState(String(init?.discounts?.[0]?.value ?? ""));

  const [scopeRows, setScopeRows] = useState<ScopeRow[]>(
    init?.scopeItems?.length
      ? init.scopeItems.map((s) => ({
          key: uid(),
          title: s.title,
          description: s.description ?? "",
          included: s.included,
        }))
      : [],
  );
  const [scopeSummary, setScopeSummary] = useState(init?.scopeSummary ?? "");
  const [exclusions, setExclusions] = useState(init?.exclusions ?? "");
  const [assumptions, setAssumptions] = useState(init?.assumptions ?? "");
  const [terms, setTerms] = useState(init?.terms ?? "");
  const [validUntil, setValidUntil] = useState(init?.validUntil ?? "");
  const [showFeeDerivation, setShowFeeDerivation] = useState(init?.showFeeDerivation ?? true);

  const [templateKey, setTemplateKey] = useState("");

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const t = getTemplate(key);
    if (!t) return;
    setBasisType(t.defaultBasis);
    setFees(
      t.fees.map((f) => ({
        ...emptyFee(),
        label: f.label,
        method: f.method,
        percent: f.percent != null ? String(f.percent) : "",
        fixedAmount: f.fixedAmount != null ? String(f.fixedAmount) : "",
        quantity: f.quantity != null ? String(f.quantity) : "",
        unitRate: f.unitRate != null ? String(f.unitRate) : "",
        category: f.category,
      })),
    );
    setPhases(t.phases.map((p) => ({ key: uid(), name: p.name, percent: String(p.percentage) })));
    setScopeSummary(t.scopeSummary);
    setExclusions(t.exclusions);
    setAssumptions(t.assumptions);
    setTerms(t.terms);
  }

  const feeToComponent = (f: FeeRow) => ({
    id: f.key,
    label: f.label || "Fee",
    method: f.method,
    category: f.category,
    percent: f.method === "PERCENT_OF_BASIS" ? Number(f.percent) || 0 : null,
    fixedAmount: LUMP_METHODS.includes(f.method) ? Number(f.fixedAmount) || 0 : null,
    quantity: RATE_METHODS.includes(f.method) ? Number(f.quantity) || 0 : null,
    unitRate: RATE_METHODS.includes(f.method) ? Number(f.unitRate) || 0 : null,
    baseAmount: MARKUP_METHODS.includes(f.method) ? Number(f.baseAmount) || 0 : null,
    markupPercent: MARKUP_METHODS.includes(f.method) ? Number(f.markupPercent) || 0 : null,
    selected: f.selected,
  });

  const usesWorksheet = basisType === "TOTAL_DEVELOPMENT_COST";
  const buildCostBasis = () => {
    const anyPercent = fees.some((f) => f.method === "PERCENT_OF_BASIS");
    if (!anyPercent) return null;
    return {
      type: basisType,
      amount: Number(basisAmount) || 0,
      sourceField: basisSourceField || null,
      worksheet: usesWorksheet
        ? worksheet
            .filter((w) => w.category || Number(w.amount) > 0)
            .map((w) => ({
              category: w.category || "Item",
              amount: Number(w.amount) || 0,
              includedInBasis: w.included,
              isProfessionalFees: w.isProfFees,
            }))
        : undefined,
    };
  };

  // Build the exact engine input so the preview equals what the server will store.
  const calcInput: ProposalCalcInput = useMemo(() => {
    return {
      currency,
      costBasis: buildCostBasis(),
      feeComponents: fees.map(feeToComponent),
      // Blank rows are dropped here too, so the preview matches the payload exactly.
      phases: phases.filter(isUsedRow).map((p) => ({ id: p.key, name: p.name, percent: Number(p.percent) || 0 })),
      paymentMilestones: milestones
        .filter(isUsedRow)
        .map((m) => ({ id: m.key, name: m.name, percent: Number(m.percent) || 0 })),
      reimbursables: reimb
        .filter((r) => r.label || Number(r.amount) > 0)
        .map((r) => ({ id: r.key, label: r.label || "Reimbursable", amount: Number(r.amount) || 0 })),
      taxes: taxName && Number(taxPercent) > 0 ? [{ name: taxName, percent: Number(taxPercent), mode: "EXCLUSIVE" as const }] : [],
      discounts:
        discountLabel && Number(discountValue) > 0
          ? [{ id: "d", label: discountLabel, type: discountType, value: Number(discountValue) }]
          : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, basisType, basisAmount, basisSourceField, worksheet, fees, phases, milestones, reimb, taxName, taxPercent, discountLabel, discountType, discountValue]);

  const calc = useMemo(() => computeProposal(calcInput), [calcInput]);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2 });
  const anyPercent = fees.some((f) => f.method === "PERCENT_OF_BASIS");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    const client = clientOptions.find((c) => c.id === clientId);
    // projectOptions, not projects: a project created inline in this form is
    // not in the server-rendered list, and its name must still reach the payload.
    const project = projectOptions.find((p) => p.id === projectId);

    // Rows are filtered before they are sent, so the payload order is captured here and
    // reused to map server issue indexes back onto the row that produced them.
    const sentPhases = phases.filter(isUsedRow);
    const sentMilestones = milestones.filter(isUsedRow);
    const sentReimb = reimb.filter((r) => r.label || Number(r.amount) > 0);
    const sentScope = scopeRows.filter((s) => s.title.trim() !== "");
    const sentTaxes = taxName && Number(taxPercent) > 0 ? [{ name: taxName, percent: Number(taxPercent), mode: "EXCLUSIVE" }] : [];
    const sentDiscounts =
      discountLabel && Number(discountValue) > 0
        ? [{ id: "d", label: discountLabel, type: discountType, value: Number(discountValue) }]
        : [];
    const rowKeys: RowKeyMap = {
      feeComponents: fees.map((f) => f.key),
      phases: sentPhases.map((p) => p.key),
      paymentMilestones: sentMilestones.map((m) => m.key),
      reimbursables: sentReimb.map((r) => r.key),
      scopeItems: sentScope.map((s) => s.key),
      taxes: sentTaxes.map(() => TAX_KEY),
      discounts: sentDiscounts.map(() => DISCOUNT_KEY),
    };

    const payload = {
      title,
      currency,
      clientId: clientId || null,
      clientName: client?.name ?? null,
      projectId: projectId || null,
      projectName: project?.name ?? null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      costBasis: buildCostBasis(),
      feeComponents: fees.map(feeToComponent),
      phases: sentPhases.map((p) => ({ id: p.key, name: p.name, percent: Number(p.percent) || 0 })),
      paymentMilestones: sentMilestones.map((m) => ({ id: m.key, name: m.name, percent: Number(m.percent) || 0 })),
      reimbursables: sentReimb.map((r) => ({ id: r.key, label: r.label || "Reimbursable", amount: Number(r.amount) || 0 })),
      taxes: sentTaxes,
      discounts: sentDiscounts,
      scopeSummary: scopeSummary || null,
      scopeItems: sentScope.map((s) => ({
        title: s.title,
        description: s.description || null,
        included: s.included,
        category: "BASE" as const,
      })),
      exclusions: exclusions || null,
      assumptions: assumptions || null,
      terms: terms || null,
      validUntil: validUntil || null,
      showFeeDerivation,
    };

    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateServiceProposalAction(initial.id, payload)
          : await createServiceProposalAction(payload);
      if (!res.ok) {
        setError(res.error);
        setIssues(res.fieldIssues ? mapIssues(res.fieldIssues, rowKeys) : []);
        return;
      }
      router.push(`/design/service-proposals/${res.id}`);
      router.refresh();
    });
  }

  const phasePct = phases.reduce((s, p) => s + (Number(p.percent) || 0), 0);

  /**
   * Every issue path that has an inline slot below. Anything outside this set — a rule on a
   * field this form does not render, or one whose row was dropped — is listed verbatim in
   * the summary instead, so a rejection can never be invisible.
   */
  const reachablePaths = useMemo(() => {
    // `currency` is deliberately absent: it is a fixed dropdown with no error slot, so a
    // rule that somehow rejected it must reach the summary rather than vanish.
    const p = new Set<string>(["title", "contactName", "contactEmail", "validUntil", "costBasis.amount"]);
    for (const f of fees) {
      p.add(`feeComponents.${f.key}.label`);
      if (f.method === "PERCENT_OF_BASIS") p.add(`feeComponents.${f.key}.percent`);
      if (LUMP_METHODS.includes(f.method)) p.add(`feeComponents.${f.key}.fixedAmount`);
      if (RATE_METHODS.includes(f.method)) {
        p.add(`feeComponents.${f.key}.quantity`);
        p.add(`feeComponents.${f.key}.unitRate`);
      }
      if (MARKUP_METHODS.includes(f.method)) {
        p.add(`feeComponents.${f.key}.baseAmount`);
        p.add(`feeComponents.${f.key}.markupPercent`);
      }
    }
    const addAll = (...paths: string[]) => paths.forEach((x) => p.add(x));
    for (const x of phases) addAll(`phases.${x.key}.name`, `phases.${x.key}.percent`);
    for (const x of milestones) addAll(`paymentMilestones.${x.key}.name`, `paymentMilestones.${x.key}.percent`);
    for (const x of reimb) addAll(`reimbursables.${x.key}.label`, `reimbursables.${x.key}.amount`);
    for (const x of scopeRows) addAll(`scopeItems.${x.key}.title`, `scopeItems.${x.key}.description`);
    addAll(`taxes.${TAX_KEY}.name`, `taxes.${TAX_KEY}.percent`);
    addAll(`discounts.${DISCOUNT_KEY}.label`, `discounts.${DISCOUNT_KEY}.value`);
    return p;
  }, [fees, phases, milestones, reimb, scopeRows]);

  const orphanIssues = issues.filter((i) => !reachablePaths.has(i.path));

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6" ref={nav}>
        {mode === "new" ? (
          <Card>
            <CardHeader title="Start from a template" subtitle="Optional — prefills fees, phases and scope for a common project type" />
            <CardBody>
              <select
                value={templateKey}
                onChange={(e) => applyTemplate(e.target.value)}
                className={field}
              >
                <option value="">— Blank proposal —</option>
                {["Architecture", "Interior", "Engineering", "Other"].map((g) => (
                  <optgroup key={g} label={g}>
                    {PROPOSAL_TEMPLATES.filter((t) => t.group === g).map((t) => (
                      <option key={t.key} value={t.key}>{t.name} — {t.description}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {templateKey ? (
                <p className="mt-2 text-xs text-muted">Template applied — everything below is editable.</p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {/* Proposal */}
        <Card>
          <CardHeader title="Proposal" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${field} ${issueFor("title") ? fieldInvalid : ""}`}
                data-invalid={issueFor("title") ? "true" : undefined}
                aria-invalid={issueFor("title") ? true : undefined}
                placeholder="Architectural design services — Palm Beach Residence"
              />
              <FieldError msg={issueFor("title")} />
            </div>
            <div>
              <label className={label}>Client</label>
              <select
                value={newClientOpen ? NEW_CLIENT : clientId}
                onChange={(e) => onClientChange(e.target.value)}
                className={field}
              >
                <option value="">— None —</option>
                <option value={NEW_CLIENT}>+ New client</option>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {newClientOpen ? (
                <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2/30 p-3">
                  <p className="text-xs font-medium text-muted">New client</p>
                  <input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={onNewClientKeyDown}
                    className={field}
                    placeholder="Client name *"
                    aria-label="New client name"
                    autoFocus
                  />
                  <input
                    value={newClientCompany}
                    onChange={(e) => setNewClientCompany(e.target.value)}
                    onKeyDown={onNewClientKeyDown}
                    className={field}
                    placeholder="Legal / company name"
                    aria-label="New client company name"
                  />
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    onKeyDown={onNewClientKeyDown}
                    className={field}
                    placeholder="Email"
                    aria-label="New client email"
                  />
                  {newClientError ? (
                    <div className="flex items-start gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {newClientError}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveNewClient}
                      disabled={clientPending}
                      className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
                    >
                      {clientPending ? "Saving…" : "Save client"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelNewClient}
                      disabled={clientPending}
                      className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-muted hover:text-fg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <label className={label}>Project</label>
              <select
                value={newProjectOpen ? NEW_PROJECT : projectId}
                onChange={(e) => onProjectChange(e.target.value)}
                className={field}
              >
                <option value="">— None —</option>
                <option value={NEW_PROJECT}>+ New project</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {newProjectOpen ? (
                <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-2/30 p-3">
                  <p className="text-xs font-medium text-muted">New project</p>
                  <input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={onNewProjectKeyDown}
                    className={field}
                    placeholder="Project name *"
                    aria-label="New project name"
                    autoFocus
                  />
                  <input
                    value={newProjectAddress}
                    onChange={(e) => setNewProjectAddress(e.target.value)}
                    onKeyDown={onNewProjectKeyDown}
                    className={field}
                    placeholder="Site address"
                    aria-label="New project site address"
                  />
                  {/* A project must belong to a client, so say which one it will
                   * be filed under rather than letting the server reject it. */}
                  <p className="text-[11px] text-faint">
                    {clientOptions.find((c) => c.id === clientId)
                      ? `Filed under ${clientOptions.find((c) => c.id === clientId)!.name}. Number and standard phases are assigned automatically.`
                      : "Choose a client above first — a project must belong to one."}
                  </p>
                  {newProjectError ? (
                    <div className="flex items-start gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {newProjectError}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveNewProject}
                      disabled={projectPending}
                      className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
                    >
                      {projectPending ? "Saving…" : "Save project"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelNewProject}
                      disabled={projectPending}
                      className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-muted hover:text-fg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <label className={label}>Contact name</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={`${field} ${issueFor("contactName") ? fieldInvalid : ""}`}
                data-invalid={issueFor("contactName") ? "true" : undefined}
                aria-invalid={issueFor("contactName") ? true : undefined}
              />
              <FieldError msg={issueFor("contactName")} />
            </div>
            <div>
              <label className={label}>Contact email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={`${field} ${issueFor("contactEmail") ? fieldInvalid : ""}`}
                data-invalid={issueFor("contactEmail") ? "true" : undefined}
                aria-invalid={issueFor("contactEmail") ? true : undefined}
              />
              <FieldError msg={issueFor("contactEmail")} />
            </div>
            <div>
              <label className={label}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </CardBody>
        </Card>

        {/* Cost basis */}
        {anyPercent ? (
          <Card>
            <CardHeader title="Cost basis" subtitle="What the percentage fees are calculated from" />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={label}>Basis *</label>
                <select value={basisType} onChange={(e) => setBasisType(e.target.value as CostBasisType)} className={field}>
                  {BASIS_TYPES.map((b) => <option key={b} value={b}>{COST_BASIS_LABEL[b]}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Amount *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={basisAmount}
                  onChange={(e) => setBasisAmount(e.target.value)}
                  className={`${field} text-right ${issueFor("costBasis.amount") ? fieldInvalid : ""}`}
                  data-invalid={issueFor("costBasis.amount") ? "true" : undefined}
                  aria-invalid={issueFor("costBasis.amount") ? true : undefined}
                  placeholder="2500000"
                />
                <FieldError msg={issueFor("costBasis.amount")} />
              </div>
              <div className="sm:col-span-3">
                <label className={label}>Source note (e.g. which estimate figure)</label>
                <input value={basisSourceField} onChange={(e) => setBasisSourceField(e.target.value)} className={field} placeholder="Estimate EST-2026-014 — direct cost" />
              </div>

              {usesWorksheet ? (
                <div className="sm:col-span-3 space-y-2 rounded-lg border border-border bg-surface-2/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Development-cost worksheet</span>
                    <span className="text-xs text-muted">
                      When a line is flagged as professional fees, the fee basis excludes it to avoid a circular calculation.
                    </span>
                  </div>
                  {worksheet.map((w) => {
                    const setW = (patch: Partial<WorksheetRow>) => setWorksheet((p) => p.map((x) => x.key === w.key ? { ...x, ...patch } : x));
                    return (
                      <div key={w.key} className="grid items-center gap-2 sm:grid-cols-[1fr_130px_auto_auto_32px]">
                        <input value={w.category} onChange={(e) => setW({ category: e.target.value })} className={field} placeholder="Building construction" />
                        <input type="number" step="any" min="0" value={w.amount} onChange={(e) => setW({ amount: e.target.value })} className={`${field} text-right`} placeholder="2000000" />
                        <label className="inline-flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={w.included} onChange={(e) => setW({ included: e.target.checked })} /> In basis</label>
                        <label className="inline-flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={w.isProfFees} onChange={(e) => setW({ isProfFees: e.target.checked })} /> Prof. fees</label>
                        <button type="button" onClick={() => setWorksheet((p) => p.filter((x) => x.key !== w.key))} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setWorksheet((p) => [...p, { key: uid(), category: "", amount: "", included: true, isProfFees: false }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1 text-xs font-medium text-muted hover:border-brand hover:text-fg">
                    <Plus className="h-3.5 w-3.5" /> Add cost line
                  </button>
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {/* Fees */}
        <Card>
          <CardHeader title="Professional fees" subtitle="One line per discipline or service" />
          <CardBody className="space-y-2">
            {fees.map((f) => {
              const set = (patch: Partial<FeeRow>) =>
                setFees((p) => p.map((x) => (x.key === f.key ? { ...x, ...patch } : x)));
              const iss = (leaf: string) => issueFor(`feeComponents.${f.key}.${leaf}`);
              const compAmount = calc.components.find((c) => c.id === f.key)?.calculatedAmount ?? 0;
              return (
                <div key={f.key} className="rounded-lg border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_180px_40px]">
                    <div>
                      <input
                        value={f.label}
                        onChange={(e) => set({ label: e.target.value })}
                        className={`${field} ${iss("label") ? fieldInvalid : ""}`}
                        data-invalid={iss("label") ? "true" : undefined}
                        aria-invalid={iss("label") ? true : undefined}
                        placeholder="Architecture"
                      />
                      <FieldError msg={iss("label")} />
                    </div>
                    <select value={f.method} onChange={(e) => set({ method: e.target.value as FeeMethod })} className={field}>
                      {FEE_METHOD_ORDER.map((m) => <option key={m} value={m}>{FEE_METHOD_LABEL[m]}</option>)}
                    </select>
                    <button type="button" onClick={() => setFees((p) => p.length === 1 ? p : p.filter((x) => x.key !== f.key))} disabled={fees.length === 1} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600 disabled:opacity-30" aria-label="Remove fee"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  {/* Method-specific inputs */}
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_140px]">
                    {f.method === "PERCENT_OF_BASIS" ? (
                      <label className="text-xs text-muted">Percentage
                        <input type="number" step="any" min="0" value={f.percent} onChange={(e) => set({ percent: e.target.value })} className={`${field} mt-0.5 text-right ${iss("percent") ? fieldInvalid : ""}`} data-invalid={iss("percent") ? "true" : undefined} aria-invalid={iss("percent") ? true : undefined} placeholder="7.5" />
                        <FieldError msg={iss("percent")} />
                      </label>
                    ) : null}
                    {LUMP_METHODS.includes(f.method) ? (
                      <label className="text-xs text-muted">Amount
                        <input type="number" step="any" min="0" value={f.fixedAmount} onChange={(e) => set({ fixedAmount: e.target.value })} className={`${field} mt-0.5 text-right ${iss("fixedAmount") ? fieldInvalid : ""}`} data-invalid={iss("fixedAmount") ? "true" : undefined} aria-invalid={iss("fixedAmount") ? true : undefined} placeholder="55000" />
                        <FieldError msg={iss("fixedAmount")} />
                      </label>
                    ) : null}
                    {RATE_METHODS.includes(f.method) ? (
                      <>
                        <label className="text-xs text-muted">{(RATE_METHOD_UNIT[f.method] ?? "quantity")[0].toUpperCase() + (RATE_METHOD_UNIT[f.method] ?? "quantity").slice(1)}
                          <input type="number" step="any" min="0" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} className={`${field} mt-0.5 text-right ${iss("quantity") ? fieldInvalid : ""}`} data-invalid={iss("quantity") ? "true" : undefined} aria-invalid={iss("quantity") ? true : undefined} placeholder="120" />
                          <FieldError msg={iss("quantity")} />
                        </label>
                        <label className="text-xs text-muted">Rate
                          <input type="number" step="any" min="0" value={f.unitRate} onChange={(e) => set({ unitRate: e.target.value })} className={`${field} mt-0.5 text-right ${iss("unitRate") ? fieldInvalid : ""}`} data-invalid={iss("unitRate") ? "true" : undefined} aria-invalid={iss("unitRate") ? true : undefined} placeholder="150" />
                          <FieldError msg={iss("unitRate")} />
                        </label>
                      </>
                    ) : null}
                    {MARKUP_METHODS.includes(f.method) ? (
                      <>
                        <label className="text-xs text-muted">Base cost
                          <input type="number" step="any" min="0" value={f.baseAmount} onChange={(e) => set({ baseAmount: e.target.value })} className={`${field} mt-0.5 text-right ${iss("baseAmount") ? fieldInvalid : ""}`} data-invalid={iss("baseAmount") ? "true" : undefined} aria-invalid={iss("baseAmount") ? true : undefined} placeholder="40000" />
                          <FieldError msg={iss("baseAmount")} />
                        </label>
                        <label className="text-xs text-muted">Markup %
                          <input type="number" step="any" min="0" value={f.markupPercent} onChange={(e) => set({ markupPercent: e.target.value })} className={`${field} mt-0.5 text-right ${iss("markupPercent") ? fieldInvalid : ""}`} data-invalid={iss("markupPercent") ? "true" : undefined} aria-invalid={iss("markupPercent") ? true : undefined} placeholder="10" />
                          <FieldError msg={iss("markupPercent")} />
                        </label>
                      </>
                    ) : null}
                    <div className="flex items-end justify-end pb-2 text-sm tabular-nums text-fg">{money(compAmount)}</div>
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                    <label className="inline-flex items-center gap-1.5">
                      <span>Type</span>
                      <select value={f.category} onChange={(e) => set({ category: e.target.value as ServiceCategory })} className="h-7 rounded border border-border bg-surface px-2 text-xs">
                        <option value="BASE">Base</option>
                        <option value="OPTIONAL">Optional</option>
                        <option value="ADDITIONAL">Additional</option>
                      </select>
                    </label>
                    {f.category === "OPTIONAL" ? (
                      <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={f.selected} onChange={(e) => set({ selected: e.target.checked })} />
                        <span>Selected (include in total)</span>
                      </label>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => setFees((p) => [...p, emptyFee()])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add fee line
            </button>
          </CardBody>
        </Card>

        {/* Phases */}
        <Card>
          <CardHeader title="Design phases" subtitle="How the base fee is distributed — should total 100%" />
          <CardBody className="space-y-2">
            {phases.map((ph) => {
              const iss = (leaf: string) => issueFor(`phases.${ph.key}.${leaf}`);
              return (
                <div key={ph.key} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_40px]">
                  <div>
                    <input value={ph.name} onChange={(e) => setPhases((p) => p.map((x) => x.key === ph.key ? { ...x, name: e.target.value } : x))} className={`${field} ${iss("name") ? fieldInvalid : ""}`} data-invalid={iss("name") ? "true" : undefined} aria-invalid={iss("name") ? true : undefined} />
                    <FieldError msg={iss("name")} />
                  </div>
                  <div>
                    <input type="number" step="any" min="0" value={ph.percent} onChange={(e) => setPhases((p) => p.map((x) => x.key === ph.key ? { ...x, percent: e.target.value } : x))} className={`${field} text-right ${iss("percent") ? fieldInvalid : ""}`} data-invalid={iss("percent") ? "true" : undefined} aria-invalid={iss("percent") ? true : undefined} />
                    <FieldError msg={iss("percent")} />
                  </div>
                  <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-muted">
                    {money((calc.totals.baseFeeTotal * (Number(ph.percent) || 0)) / 100)}
                  </div>
                  <button type="button" onClick={() => setPhases((p) => p.length === 1 ? p : p.filter((x) => x.key !== ph.key))} disabled={phases.length === 1} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600 disabled:opacity-30" aria-label="Remove phase"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setPhases((p) => [...p, { key: uid(), name: "", percent: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
                <Plus className="h-4 w-4" /> Add phase
              </button>
              <span className={`ml-auto text-sm tabular-nums ${Math.abs(phasePct - 100) < 0.005 ? "text-muted" : "font-medium text-amber-600 dark:text-amber-400"}`}>
                Total {Math.round(phasePct * 100) / 100}%{Math.abs(phasePct - 100) < 0.005 ? "" : " — should be 100%"}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Payment schedule */}
        <Card>
          <CardHeader title="Payment schedule" subtitle="Optional — should total 100% of the grand total" />
          <CardBody className="space-y-2">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted">No payment milestones yet.</p>
            ) : milestones.map((m) => {
              const iss = (leaf: string) => issueFor(`paymentMilestones.${m.key}.${leaf}`);
              return (
                <div key={m.key} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_40px]">
                  <div>
                    <input value={m.name} onChange={(e) => setMilestones((p) => p.map((x) => x.key === m.key ? { ...x, name: e.target.value } : x))} className={`${field} ${iss("name") ? fieldInvalid : ""}`} data-invalid={iss("name") ? "true" : undefined} aria-invalid={iss("name") ? true : undefined} placeholder="On acceptance" />
                    <FieldError msg={iss("name")} />
                  </div>
                  <div>
                    <input type="number" step="any" min="0" value={m.percent} onChange={(e) => setMilestones((p) => p.map((x) => x.key === m.key ? { ...x, percent: e.target.value } : x))} className={`${field} text-right ${iss("percent") ? fieldInvalid : ""}`} data-invalid={iss("percent") ? "true" : undefined} aria-invalid={iss("percent") ? true : undefined} />
                    <FieldError msg={iss("percent")} />
                  </div>
                  <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-muted">
                    {money((calc.totals.grandTotal * (Number(m.percent) || 0)) / 100)}
                  </div>
                  <button type="button" onClick={() => setMilestones((p) => p.filter((x) => x.key !== m.key))} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600" aria-label="Remove milestone"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => setMilestones((p) => [...p, { key: uid(), name: "", percent: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add milestone
            </button>
          </CardBody>
        </Card>

        {/* Reimbursables */}
        <Card>
          <CardHeader title="Reimbursable expenses" subtitle="Printing, travel, permit fees — added to the subtotal" />
          <CardBody className="space-y-2">
            {reimb.length === 0 ? (
              <p className="text-sm text-muted">No reimbursables yet.</p>
            ) : reimb.map((r) => {
              const iss = (leaf: string) => issueFor(`reimbursables.${r.key}.${leaf}`);
              return (
                <div key={r.key} className="grid gap-2 sm:grid-cols-[1fr_140px_40px]">
                  <div>
                    <input value={r.label} onChange={(e) => setReimb((p) => p.map((x) => x.key === r.key ? { ...x, label: e.target.value } : x))} className={`${field} ${iss("label") ? fieldInvalid : ""}`} data-invalid={iss("label") ? "true" : undefined} aria-invalid={iss("label") ? true : undefined} placeholder="Printing & plotting" />
                    <FieldError msg={iss("label")} />
                  </div>
                  <div>
                    <input type="number" step="any" min="0" value={r.amount} onChange={(e) => setReimb((p) => p.map((x) => x.key === r.key ? { ...x, amount: e.target.value } : x))} className={`${field} text-right ${iss("amount") ? fieldInvalid : ""}`} data-invalid={iss("amount") ? "true" : undefined} aria-invalid={iss("amount") ? true : undefined} placeholder="1500" />
                    <FieldError msg={iss("amount")} />
                  </div>
                  <button type="button" onClick={() => setReimb((p) => p.filter((x) => x.key !== r.key))} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600" aria-label="Remove reimbursable"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => setReimb((p) => [...p, { key: uid(), label: "", amount: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add reimbursable
            </button>
          </CardBody>
        </Card>

        {/* Tax & discount */}
        <Card>
          <CardHeader title="Tax & discount" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tax name</label>
                <input value={taxName} onChange={(e) => setTaxName(e.target.value)} className={`${field} ${issueFor(`taxes.${TAX_KEY}.name`) ? fieldInvalid : ""}`} data-invalid={issueFor(`taxes.${TAX_KEY}.name`) ? "true" : undefined} aria-invalid={issueFor(`taxes.${TAX_KEY}.name`) ? true : undefined} placeholder="BBO" />
                <FieldError msg={issueFor(`taxes.${TAX_KEY}.name`)} />
              </div>
              <div>
                <label className={label}>Tax %</label>
                <input type="number" step="any" min="0" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className={`${field} text-right ${issueFor(`taxes.${TAX_KEY}.percent`) ? fieldInvalid : ""}`} data-invalid={issueFor(`taxes.${TAX_KEY}.percent`) ? "true" : undefined} aria-invalid={issueFor(`taxes.${TAX_KEY}.percent`) ? true : undefined} />
                <FieldError msg={issueFor(`taxes.${TAX_KEY}.percent`)} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px_90px] gap-3">
              <div>
                <label className={label}>Discount</label>
                <input value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} className={`${field} ${issueFor(`discounts.${DISCOUNT_KEY}.label`) ? fieldInvalid : ""}`} data-invalid={issueFor(`discounts.${DISCOUNT_KEY}.label`) ? "true" : undefined} aria-invalid={issueFor(`discounts.${DISCOUNT_KEY}.label`) ? true : undefined} placeholder="Repeat client" />
                <FieldError msg={issueFor(`discounts.${DISCOUNT_KEY}.label`)} />
              </div>
              <div>
                <label className={label}>Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")} className={field}>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">Fixed</option>
                </select>
              </div>
              <div>
                <label className={label}>Value</label>
                <input type="number" step="any" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={`${field} text-right ${issueFor(`discounts.${DISCOUNT_KEY}.value`) ? fieldInvalid : ""}`} data-invalid={issueFor(`discounts.${DISCOUNT_KEY}.value`) ? "true" : undefined} aria-invalid={issueFor(`discounts.${DISCOUNT_KEY}.value`) ? true : undefined} />
                <FieldError msg={issueFor(`discounts.${DISCOUNT_KEY}.value`)} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Scope of services */}
        <Card>
          <CardHeader title="Scope of services" subtitle="Itemised inclusions and exclusions — appears as a list on the document" />
          <CardBody className="space-y-2">
            {scopeRows.length === 0 ? (
              <p className="text-sm text-muted">No scope items yet — add inclusions and exclusions, or use the free-text summary below.</p>
            ) : scopeRows.map((s) => {
              const setS = (patch: Partial<ScopeRow>) => setScopeRows((p) => p.map((x) => x.key === s.key ? { ...x, ...patch } : x));
              const iss = (leaf: string) => issueFor(`scopeItems.${s.key}.${leaf}`);
              return (
                <div key={s.key} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_32px] sm:items-center">
                  <div>
                    <input value={s.title} onChange={(e) => setS({ title: e.target.value })} className={`${field} ${iss("title") ? fieldInvalid : ""}`} data-invalid={iss("title") ? "true" : undefined} aria-invalid={iss("title") ? true : undefined} placeholder="Site analysis & feasibility" />
                    <FieldError msg={iss("title")} />
                  </div>
                  <div>
                    <input value={s.description} onChange={(e) => setS({ description: e.target.value })} className={`${field} ${iss("description") ? fieldInvalid : ""}`} data-invalid={iss("description") ? "true" : undefined} aria-invalid={iss("description") ? true : undefined} placeholder="Optional detail" />
                    <FieldError msg={iss("description")} />
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={s.included} onChange={(e) => setS({ included: e.target.checked })} />
                    {s.included ? "Included" : "Excluded"}
                  </label>
                  <button type="button" onClick={() => setScopeRows((p) => p.filter((x) => x.key !== s.key))} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600" aria-label="Remove scope item"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => setScopeRows((p) => [...p, { key: uid(), title: "", description: "", included: true }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add scope item
            </button>
          </CardBody>
        </Card>

        {/* Scope & terms */}
        <Card>
          <CardHeader title="Scope narrative & terms" />
          <CardBody className="space-y-3">
            <div>
              <label className={label}>Scope summary</label>
              <textarea value={scopeSummary} onChange={(e) => setScopeSummary(e.target.value)} rows={3} className={`${field} h-auto py-2`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Exclusions</label>
                <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
              </div>
              <div>
                <label className={label}>Assumptions</label>
                <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
              </div>
            </div>
            <div>
              <label className={label}>Terms & conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Valid until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={`${field} ${issueFor("validUntil") ? fieldInvalid : ""}`} data-invalid={issueFor("validUntil") ? "true" : undefined} aria-invalid={issueFor("validUntil") ? true : undefined} />
                <FieldError msg={issueFor("validUntil")} />
              </div>
              <label className="flex items-end gap-2 pb-1.5 text-sm text-muted">
                <input type="checkbox" checked={showFeeDerivation} onChange={(e) => setShowFeeDerivation(e.target.checked)} />
                Show fee derivation to the client
              </label>
            </div>
          </CardBody>
        </Card>

        {error ? (
          <div
            ref={errorBox}
            className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-400"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {/* Only claim fields are highlighted when at least one of them actually is. */}
              {issues.length > 0 && orphanIssues.length === issues.length
                ? "The proposal could not be saved:"
                : error}
            </div>
            {orphanIssues.length > 0 ? (
              // Issues with no input to highlight — spelled out here so the user is never
              // told to fix a field they cannot find.
              <ul className="mt-2 list-disc space-y-1 pl-8 text-xs">
                {orphanIssues.map((i, n) => (
                  <li key={`${i.path}-${n}`}>
                    <span className="font-medium">{i.label}:</span> {i.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
            {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create proposal"}
          </button>
          <button type="button" onClick={() => router.back()} className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg">Cancel</button>
        </div>
      </div>

      {/* Live summary rail */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-fg">Live summary</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Base fee" v={money(calc.totals.baseFeeTotal)} />
            {calc.totals.optionalServicesTotal > 0 ? (
              <Row k="Optional (selected)" v={money(calc.totals.optionalSelectedTotal)} muted />
            ) : null}
            {calc.totals.reimbursablesTotal > 0 ? <Row k="Reimbursables" v={money(calc.totals.reimbursablesTotal)} /> : null}
            <Row k="Subtotal" v={money(calc.totals.subtotal)} />
            {calc.totals.discountTotal > 0 ? <Row k="Discount" v={`− ${money(calc.totals.discountTotal)}`} /> : null}
            {calc.totals.taxTotal > 0 ? <Row k={`Tax`} v={money(calc.totals.taxTotal)} /> : null}
            <div className="mt-1.5 flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{money(calc.totals.grandTotal)}</dd>
            </div>
          </dl>

          {calc.totals.optionalServicesTotal - calc.totals.optionalSelectedTotal > 0 ? (
            <p className="mt-2 text-xs text-muted">
              + {money(calc.totals.optionalServicesTotal - calc.totals.optionalSelectedTotal)} in unselected options
            </p>
          ) : null}

          {calc.errors.length > 0 ? (
            <div className="mt-3 space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-700 dark:text-rose-400">
              {calc.errors.map((e, i) => (
                <div key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e.message}</div>
              ))}
            </div>
          ) : null}
          {calc.warnings.length > 0 ? (
            <div className="mt-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              {calc.warnings.map((w, i) => (
                <div key={i} className="flex gap-1.5"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {w.message}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** Inline message under a rejected input. Renders nothing when the field was accepted. */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{msg}</p>;
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted" : "text-muted"}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </div>
  );
}
