/**
 * OrderDocument — the branded A4 "Order Confirmation" sheet.
 *
 * One presentational component, no hooks, so it renders identically wherever it
 * is used (today: the print route app/print/orders/[id]). Mirrors the
 * MeetingDocument/ProposalDocument structure/idioms. Pass a full OrderRecord.
 *
 * Client-safe imports only (types/labels from orders.types, lib/format) — it
 * must never pull lib/data/orders (Postgres driver).
 */

import { ORDER_STATUS_LABEL, type OrderRecord } from "@/lib/data/orders.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { documentFooterLine, firmLocation, firmName } from "@/lib/firm-identity";

export function OrderDocument({
  order,
  logoDataUrl,
  logo,
  companyName,
  companyLocation,
  sheet = true,
}: {
  order: OrderRecord;
  logoDataUrl?: string | null;
  /** Logo placement (position + size); falls back to a left-aligned default. */
  logo?: { position?: "left" | "center" | "right"; size?: number };
  /** Configured practice name. Server print routes pass it; previews fall back to
   *  the client-seeded firm identity (see lib/firm-identity.ts). */
  companyName?: string;
  /** Configured practice location for the footer; omitted entirely when unset. */
  companyLocation?: string;
  /**
   * Whether to draw the paper this document sits on. False when `PrintSurface`
   * supplies a sheet sized from the page tokens — see the same note on
   * MeetingDocument.
   */
  sheet?: boolean;
}) {
  const firm = firmName(companyName);
  const location = firmLocation(companyLocation);
  const body = (
    <>
      {/* Letterhead */}
      <DocumentLetterhead
        logo={{ dataUrl: logoDataUrl, position: logo?.position, size: logo?.size }}
        name={companyName}
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Order Confirmation</div>
            <div className="mt-1 text-xs text-gray-600">{ORDER_STATUS_LABEL[order.status]}</div>
            <div className="text-xs text-gray-500">{order.orderNumber}</div>
          </div>
        }
      />

      {/* Title */}
      <h1 className="mt-7 text-xl font-bold text-gray-900">{order.title || "Untitled order"}</h1>
      <div className="mt-1 text-sm text-gray-600">{order.clientName}</div>

      {/* Header block */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 rounded-md bg-gray-50 px-4 py-4 text-xs print:bg-gray-50">
        <div>
          <div className="text-gray-400">Order No</div>
          <div className="font-medium text-gray-900">{order.orderNumber}</div>
        </div>
        <div>
          <div className="text-gray-400">Status</div>
          <div className="font-medium text-gray-900">{ORDER_STATUS_LABEL[order.status]}</div>
        </div>
        <div>
          <div className="text-gray-400">Client</div>
          <div className="font-medium text-gray-900">{order.clientName}</div>
        </div>
        <div>
          <div className="text-gray-400">Service type</div>
          <div className="font-medium text-gray-900">{order.serviceType || "—"}</div>
        </div>
        {order.proposalRef ? (
          <div>
            <div className="text-gray-400">Source proposal</div>
            <div className="font-medium text-gray-900">{order.proposalRef}</div>
          </div>
        ) : null}
        {order.siteAddress ? (
          <div>
            <div className="text-gray-400">Site address</div>
            <div className="font-medium text-gray-900">{order.siteAddress}</div>
          </div>
        ) : null}
        <div>
          <div className="text-gray-400">Expected start</div>
          <div className="font-medium text-gray-900">{formatDate(order.expectedStartDate)}</div>
        </div>
        <div>
          <div className="text-gray-400">Expected end</div>
          <div className="font-medium text-gray-900">{formatDate(order.expectedEndDate)}</div>
        </div>
      </div>

      {/* Fee */}
      <div className="mt-6 flex items-baseline justify-between rounded-md border border-gray-300 px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Order Fee</div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(order.fee, order.currency)}
        </div>
      </div>

      {/* Narrative sections */}
      <div className="mt-7 space-y-4">
        {order.scopeSummary ? (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Scope of Services</h2>
            <p className="mt-1 whitespace-pre-line text-gray-700">{order.scopeSummary}</p>
          </section>
        ) : null}
        {order.notes ? (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Notes</h2>
            <p className="mt-1 whitespace-pre-line text-gray-700">{order.notes}</p>
          </section>
        ) : null}
      </div>

      {/* Signature / acceptance footer. Kept whole: a signature line separated
       * from the name it belongs to is not a signable document. */}
      <div className="mt-12 grid grid-cols-2 gap-10" data-keep-together>
        <div>
          <div className="h-12 border-b border-gray-400" />
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">For {firm}</div>
          <div className="mt-1 text-[10px] text-gray-400">Name · Signature · Date</div>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400" />
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Client acceptance</div>
          <div className="mt-1 text-[10px] text-gray-400">Name · Signature · Date</div>
        </div>
      </div>

      <div className="mt-10 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {documentFooterLine(firm, location, `Order ${order.orderNumber}`)}
      </div>
    </>
  );

  if (!sheet) return body;
  return (
    <div className="mx-auto w-[820px] max-w-full bg-white p-12 text-[13px] leading-relaxed text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      {body}
    </div>
  );
}
