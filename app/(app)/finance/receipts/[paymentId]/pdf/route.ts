/**
 * One payment's receipt as a PDF file, generated on the server
 * (lib/finance/invoice-pdf.ts) — the same file "Email receipt" attaches. A
 * payment recorded before receipts were numbered is numbered the first time
 * this opens. `?download=1` saves it instead of opening it.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/lib/i18n/server";
import { renderReceiptPdf } from "@/lib/server/invoice-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await getServerSession(authOptions);
  const t = await getServerT();
  if (!session?.user?.companyId) {
    return new NextResponse(t("Sign in to open this receipt."), { status: 401 });
  }
  const { paymentId } = await params;
  const pdf = await renderReceiptPdf(paymentId);
  if (!pdf) return new NextResponse(t("That payment could not be found."), { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${pdf.filename}"`,
      "cache-control": "no-store",
    },
  });
}
