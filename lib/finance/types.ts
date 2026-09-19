/**
 * Finance — client-safe types and label tables.
 *
 * CLIENT-SAFE. No Prisma import, no "server-only": the invoice screens are
 * client components and importing the generated enums here would drag the
 * server into the browser bundle. The unions below mirror the schema's enums
 * exactly, and `lib/finance/enums.test.ts` fails the build if they drift.
 */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PART_PAID" | "PAID" | "VOID";

export type InvoicePaymentMethod = "BANK_TRANSFER" | "CASH" | "CHEQUE" | "CARD" | "OTHER";

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

/** In the order an invoice lives it, not alphabetically. */
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "PART_PAID",
  "PAID",
  "VOID",
];

export const PAYMENT_METHODS: InvoicePaymentMethod[] = [
  "BANK_TRANSFER",
  "CASH",
  "CHEQUE",
  "CARD",
  "OTHER",
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PART_PAID: "Part paid",
  PAID: "Paid",
  VOID: "Void",
};

export const PAYMENT_METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
};

export const TAX_MODE_LABEL: Record<TaxMode, string> = {
  EXCLUSIVE: "Added to the net amount",
  INCLUSIVE: "Already included in the amounts",
};

/** The app's existing badge vocabulary — never a new colour system. */
export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  DRAFT: "slate",
  ISSUED: "blue",
  PART_PAID: "amber",
  PAID: "green",
  VOID: "slate",
};

/** Statuses where money is still owed — what the receivables view is about. */
export const OPEN_STATUSES: InvoiceStatus[] = ["ISSUED", "PART_PAID"];

export function isOpenStatus(status: InvoiceStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

// ── DTOs ───────────────────────────────────────────────────────────────────
//
// Dates cross this boundary as `YYYY-MM-DD` strings, timestamps as ISO strings
// and money as major-unit numbers: a Decimal cannot be handed from a server
// component to a client one, and a half-serialised one renders as "[object]".

export type InvoiceLineDTO = {
  id: string;
  invoiceId: string;
  description: string;
  milestoneId: string | null;
  milestoneName: string | null;
  quantity: number | null;
  unitRate: number | null;
  amount: number;
  taxable: boolean;
  sortOrder: number;
};

export type InvoicePaymentDTO = {
  id: string;
  invoiceId: string;
  paidAt: string;
  amount: number;
  method: InvoicePaymentMethod;
  reference: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: string;
};

/** A row in the invoice register. Everything the list and its print need. */
export type InvoiceSummaryDTO = {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  proposalNumber: string | null;
  title: string | null;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Derived from the payments, never stored: see lib/finance/calc.ts. */
  paid: number;
  outstanding: number;
  paymentCount: number;
  lineCount: number;
  updatedAt: string;
};

export type InvoiceDTO = InvoiceSummaryDTO & {
  contactName: string | null;
  contactEmail: string | null;
  billingAddress: string | null;
  serviceProposalId: string | null;
  intro: string | null;
  termsDays: number | null;
  taxName: string | null;
  taxPercent: number;
  taxMode: TaxMode;
  taxableSubtotal: number;
  notes: string | null;
  footer: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  lines: InvoiceLineDTO[];
  payments: InvoicePaymentDTO[];
};

// ── Write inputs ───────────────────────────────────────────────────────────

export type InvoiceLineInput = {
  description: string;
  milestoneId?: string | null;
  milestoneName?: string | null;
  quantity?: number | null;
  unitRate?: number | null;
  amount: number;
  taxable?: boolean;
};

export type InvoiceInput = {
  /** Blank means "assign the next number in the practice sequence". */
  number?: string;
  currency?: string;
  clientId?: string | null;
  clientName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  billingAddress?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  serviceProposalId?: string | null;
  proposalNumber?: string | null;
  title?: string | null;
  intro?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  termsDays?: number | null;
  taxName?: string | null;
  taxPercent?: number | null;
  taxMode?: TaxMode;
  notes?: string | null;
  footer?: string | null;
  lines: InvoiceLineInput[];
};

export type InvoicePaymentInput = {
  paidAt: string;
  amount: number;
  method: InvoicePaymentMethod;
  reference?: string | null;
  notes?: string | null;
};

/** The register's filters. */
export type InvoiceFilter = {
  status?: InvoiceStatus | "ALL" | "OPEN" | "OVERDUE";
  clientId?: string;
  projectId?: string;
  currency?: string;
  /** Free text over number, client, project, proposal number and title. */
  q?: string;
};

/**
 * A proposal milestone offered for invoicing, with what has already been
 * billed against it. `remaining` is what a new invoice would take.
 */
export type BillableMilestone = {
  id: string;
  name: string;
  trigger: string | null;
  percent: number;
  amount: number;
  invoiced: number;
  remaining: number;
  /** The invoices that already bill this milestone, for the "why" of a zero. */
  invoiceNumbers: string[];
};

export type ProposalBilling = {
  serviceProposalId: string;
  proposalNumber: string;
  title: string;
  status: string;
  currency: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  grandTotal: number;
  taxName: string | null;
  taxPercent: number;
  taxMode: TaxMode;
  milestones: BillableMilestone[];
  /** Engine warnings worth refusing on — e.g. milestones that do not total 100%. */
  warnings: string[];
};
