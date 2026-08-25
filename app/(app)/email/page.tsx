import { Mail } from "lucide-react";
import { listEmailLog } from "@/lib/data/email-log";

export const metadata = { title: "Sent Email · AEC-flow" };

/**
 * Every email this practice has attempted to send, newest first — successes and
 * failures in one list.
 *
 * WHY IT IS A PAGE AND NOT A TOAST. The incident behind this module was a send
 * that produced no delivery and no trace, so the person who pressed the button
 * had nowhere to look afterwards. A per-document history lives in the compose
 * dialog; this is the same record without needing to know which document to open
 * first, which is the question you have when the answer is "none of them went".
 *
 * The rows are company-scoped by the Prisma tenant extension (EmailLog is in
 * TENANT_MODELS) — this page adds no filter of its own and must not, so the
 * scope cannot be forgotten here.
 */
export default async function EmailLogPage() {
  const entries = await listEmailLog({ limit: 100 });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Sent Email</h2>
        <p className="text-sm text-muted">
          Every message AEC-flow has attempted to send for this practice, including the ones that failed.
          Documents are never attached — see the note in the compose panel.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Mail className="h-6 w-6 text-faint" />
          <div className="text-sm font-medium text-fg">No email has been sent yet</div>
          <div className="max-w-md text-xs text-muted">
            Use the Email button on an estimate, programme, drawing or report. Whatever happens — delivered or
            refused — it is recorded here.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Document</th>
                <th className="px-3 py-2 font-medium">Sent by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        e.status === "SENT" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-fg">
                    {e.to}
                    {e.cc.length > 0 ? <span className="block text-faint">cc {e.cc.join(", ")}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-fg">
                    {e.subject}
                    {/* The failure text is the reason this table exists — it is not
                        hidden behind a hover or an expander. */}
                    {e.status === "FAILED" && e.error ? (
                      <span className="mt-0.5 block text-rose-700">{e.error}</span>
                    ) : null}
                    {e.status === "SENT" && e.providerMessageId ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-faint">{e.providerMessageId}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{e.documentName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{e.senderName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
