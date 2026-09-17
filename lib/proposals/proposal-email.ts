/**
 * Emailing a service proposal: who it is addressed to, and what the message says.
 *
 * Pure. Money and dates arrive ALREADY FORMATTED from the page, which holds the
 * proposal's own currency and the practice's locale — a second formatter here
 * would be a second opinion about what the client owes, and the two would drift.
 *
 * WHY THE FIGURES ARE IN THE BODY. This app cannot attach anything: its documents
 * are produced by the browser's print dialog, so there is no file on the server to
 * enclose. A message that named a proposal and carried none of it would make the
 * client open AEC-flow, which they cannot sign into. So the commercially decisive
 * lines travel in the text — the fee, the total, the payment milestones and the
 * validity date — and the full document, with the scope, the exclusions and the
 * conditions, remains the printed proposal.
 *
 * Nothing here claims an attachment. The sender is told separately to attach the
 * PDF themselves, and they may not; a body that promised one would be the same
 * lie as the green "Queued" tick this email module was rebuilt to remove.
 */

export type ProposalEmailInput = {
  number: string;
  title: string;
  /** Shown only from rev 2 — "rev 1" on a first issue reads like a correction. */
  revision?: number;
  clientName: string | null;
  projectName: string | null;
  /** Formatted for reading, or null. */
  issuedAt: string | null;
  validUntil: string | null;
  /** The fee breakdown as the screen shows it: label plus formatted amount. */
  lines: readonly { label: string; amount: string }[];
  /** The grand total, formatted. */
  total: string;
  milestones: readonly { name: string; percent: number; amount: string }[];
  senderName: string;
};

/**
 * The subject a client will recognise six months later in a search: the number
 * first, because that is what both sides quote in every later message, then the
 * project if there is one — a client with three proposals out needs to know which.
 */
export function proposalEmailSubject(
  input: Pick<ProposalEmailInput, "number" | "title" | "projectName" | "revision">,
): string {
  const what = input.projectName?.trim() || input.title.trim();
  const rev = input.revision && input.revision > 1 ? ` (rev ${input.revision})` : "";
  return `Service Proposal ${input.number} — ${what}${rev}`;
}

export function proposalEmailBody(input: ProposalEmailInput): string {
  const out: string[] = [];
  const field = (label: string, value: string | null) => {
    if (value && value.trim()) out.push(`${label.padEnd(13)}${value.trim()}`);
  };

  const rev = input.revision && input.revision > 1 ? ` · rev ${input.revision}` : "";
  out.push(`SERVICE PROPOSAL ${input.number}${rev} — ${input.title}`, "");
  field("Client:", input.clientName);
  field("Project:", input.projectName);
  field("Issued:", input.issuedAt);
  field("Valid until:", input.validUntil);

  if (input.lines.length) {
    out.push("", "FEE");
    // The widest label decides the column, so the amounts line up in a
    // monospaced mail client and read as a column rather than a list.
    const width = Math.max(...input.lines.map((l) => l.label.length), "Total".length);
    for (const line of input.lines) out.push(`  ${line.label.padEnd(width + 3)}${line.amount}`);
    out.push(`  ${"Total".padEnd(width + 3)}${input.total}`);
  } else {
    out.push("", `Total${" ".repeat(9)}${input.total}`);
  }

  if (input.milestones.length) {
    out.push("", "PAYMENT SCHEDULE");
    input.milestones.forEach((m, i) => {
      out.push(`  ${i + 1}. ${m.name} — ${m.percent}% — ${m.amount}`);
    });
  }

  out.push(
    "",
    "The scope, the exclusions and the conditions are set out in the proposal document itself.",
    "Please tell me if anything needs adjusting before we proceed.",
    "",
    "Kind regards,",
    input.senderName,
  );

  return out.join("\n");
}

/**
 * How to label a tax line so the column adds up in the reader's head.
 *
 * A tax can be ADDED to the price or CONTAINED in it, and the engine reports the
 * amount either way. Printed unqualified, a contained tax makes the email look
 * like a mistake: "Subtotal 10,000.00 / Tax 654.21 / Total 10,000.00" — measured
 * on SP-2026-011, whose 7% BBO is inclusive. A client reading that either thinks
 * the practice cannot add up or that they are being charged twice, and either way
 * they reply asking instead of signing.
 *
 * So the arithmetic decides the wording: when the total already contains the tax,
 * the line says so. Null means there is no tax line to print at all.
 */
export function taxLineLabel(totals: {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}): string | null {
  if (!(totals.taxTotal > 0)) return null;
  const netOfTax = totals.subtotal - totals.discountTotal;
  // Half a cent, because these are rounded money figures, not floats to compare.
  const contained = Math.abs(totals.grandTotal - netOfTax) < 0.005;
  return contained ? "Tax (included in the price)" : "Tax";
}

/**
 * What the sender needs to be told before this particular proposal goes out, or
 * null when there is nothing to say.
 *
 * A proposal that has not been approved for issue is an internal draft, and the
 * one accident worth engineering against is sending it to the client with the
 * client's own address helpfully pre-typed. So the button stays available — mailing
 * a draft to a colleague for comment is a real thing people do — but the address
 * is NOT prefilled and the dialog says why. Refusing outright would be the wrong
 * trade: it treats a legitimate action as a mistake, and people route around a
 * blocked button with their own mail client, where nothing is logged at all.
 */
export function proposalEmailNotice(input: {
  statusLabel: string;
  approvedForIssue: boolean;
  hasContactEmail: boolean;
}): string | null {
  if (!input.approvedForIssue) {
    return `This proposal is "${input.statusLabel}" — it has not been approved for issue, so the client's address is deliberately NOT prefilled. Approve it first, or type an internal address to circulate it for comment.`;
  }
  if (!input.hasContactEmail) {
    return "This proposal has no contact email on record, so there is nobody to prefill. Add one to the proposal, or type the address here.";
  }
  return null;
}

/** The address the proposal goes to, and only when it is fit to send. */
export function proposalRecipient(input: {
  contactEmail: string | null;
  approvedForIssue: boolean;
}): string {
  if (!input.approvedForIssue) return "";
  return (input.contactEmail ?? "").trim();
}
