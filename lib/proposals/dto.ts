/**
 * Client-safe DTO types for the Service Proposal module.
 *
 * A DTO carries the proposal's stored metadata plus a faithfully reconstructed
 * `ServiceProposalInput`. Because the fee engine is deterministic, a detail page or document
 * can re-run `computeProposal(dto.input)` to get the full breakdown and it will match the
 * stored totals exactly — so the derived breakdown is not itself persisted or shipped.
 *
 * No Prisma imports here — components import this.
 */
import type { ServiceProposalInput } from "./schema/proposal";
import type { ServiceProposalStatus } from "./engine/status";

export interface ServiceProposalDTO {
  id: string;
  number: string;
  title: string;
  kind: "QUICK" | "ADVANCED";
  status: ServiceProposalStatus;
  revision: number;
  versionLabel: string | null;

  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;

  currency: string;

  // Stored engine output (denormalised on the header).
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  grandTotal: number;
  baseFeeTotal: number;
  optionalServicesTotal: number;
  reimbursablesTotal: number;

  showFeeDerivation: boolean;
  estimatedWeeks: number | null;

  issuedAt: string | null;
  validUntil: string | null;
  lockedAt: string | null;

  createdByName: string | null;
  createdAt: string;
  updatedAt: string;

  /** Everything needed to edit or recompute the proposal. */
  input: ServiceProposalInput;
}

export interface ServiceProposalListItem {
  id: string;
  number: string;
  title: string;
  status: ServiceProposalStatus;
  revision: number;
  versionLabel: string | null;
  clientName: string | null;
  projectName: string | null;
  currency: string;
  grandTotal: number;
  feeBasisLabel: string | null;
  createdAt: string;
  validUntil: string | null;
}

export interface ServiceProposalSummary {
  total: number;
  open: number;
  openValue: number;
  acceptedValue: number;
  winRate: number;
  currency: string;
  byStatus: Record<ServiceProposalStatus, number>;
  expiringSoon: number;
}
