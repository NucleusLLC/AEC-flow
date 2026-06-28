/**
 * MeetingDocument — the branded A4 "Meeting Minutes" sheet.
 *
 * One presentational component, no hooks, so it renders identically wherever it
 * is used (today: the print route app/print/meetings/[id]). Mirrors the
 * ProposalDocument structure/idioms. Pass a full MeetingRecord.
 *
 * Client-safe imports only (types/labels from meetings.types, lib/format) — it
 * must never pull lib/data/meetings (Prisma).
 */

import {
  MEETING_TYPE_LABEL,
  ACTION_STATUS_LABEL,
  type MeetingRecord,
} from "@/lib/data/meetings.types";
import { formatDate } from "@/lib/format";
import { DocumentLetterhead, type LetterheadLogo } from "@/components/print/document-letterhead";

export function MeetingDocument({ meeting, logo }: { meeting: MeetingRecord; logo?: LetterheadLogo }) {
  return (
    <div className="mx-auto w-[820px] max-w-full bg-white p-12 text-[13px] leading-relaxed text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      {/* Letterhead */}
      <DocumentLetterhead
        logo={logo}
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Meeting Minutes</div>
            <div className="mt-1 text-xs text-gray-600">{MEETING_TYPE_LABEL[meeting.type]} meeting</div>
            <div className="text-xs text-gray-500">{formatDate(meeting.meetingDate)}</div>
          </div>
        }
      />

      {/* Title */}
      <h1 className="mt-7 text-xl font-bold text-gray-900">{meeting.title || "Untitled meeting"}</h1>

      {/* Header block */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 rounded-md bg-gray-50 px-4 py-4 text-xs print:bg-gray-50">
        <div>
          <div className="text-gray-400">Project</div>
          <div className="font-medium text-gray-900">{meeting.projectName}</div>
        </div>
        <div>
          <div className="text-gray-400">Type</div>
          <div className="font-medium text-gray-900">{MEETING_TYPE_LABEL[meeting.type]}</div>
        </div>
        <div>
          <div className="text-gray-400">Date</div>
          <div className="font-medium text-gray-900">{formatDate(meeting.meetingDate)}</div>
        </div>
        <div>
          <div className="text-gray-400">Location</div>
          <div className="font-medium text-gray-900">{meeting.location || "—"}</div>
        </div>
        <div>
          <div className="text-gray-400">Author</div>
          <div className="font-medium text-gray-900">{meeting.author}</div>
        </div>
        {meeting.followUpDate ? (
          <div>
            <div className="text-gray-400">Follow-up</div>
            <div className="font-medium text-gray-900">{formatDate(meeting.followUpDate)}</div>
          </div>
        ) : null}
      </div>

      {/* Participants */}
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Participants</div>
        {meeting.participants.length ? (
          <p className="mt-1 text-gray-700">{meeting.participants.join(", ")}</p>
        ) : (
          <p className="mt-1 text-gray-400">No participants recorded.</p>
        )}
      </div>

      {/* Narrative sections */}
      <div className="mt-7 space-y-4">
        {meeting.summary ? (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Summary</h2>
            <p className="mt-1 whitespace-pre-line text-gray-700">{meeting.summary}</p>
          </section>
        ) : null}
        {meeting.discussion ? (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Discussion</h2>
            <p className="mt-1 whitespace-pre-line text-gray-700">{meeting.discussion}</p>
          </section>
        ) : null}
        {meeting.decisions ? (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Decisions</h2>
            <p className="mt-1 whitespace-pre-line text-gray-700">{meeting.decisions}</p>
          </section>
        ) : null}
      </div>

      {/* Action items */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action Items</h2>
      <table className="mt-2 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="w-8 py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Description</th>
            <th className="py-2 pr-3 font-semibold">Assignee</th>
            <th className="py-2 pr-3 font-semibold">Due</th>
            <th className="py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {meeting.actionItems.length ? (
            meeting.actionItems.map((item, i) => (
              <tr key={item.id} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 tabular-nums text-gray-500">{i + 1}</td>
                <td className="py-2 pr-3 text-gray-900">{item.description || "—"}</td>
                <td className="py-2 pr-3 text-gray-600">{item.assignee || "—"}</td>
                <td className="py-2 pr-3 text-gray-600">{formatDate(item.dueDate)}</td>
                <td className="py-2 text-gray-600">{ACTION_STATUS_LABEL[item.status]}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="py-3 text-gray-400" colSpan={5}>No action items recorded.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-10 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        ZenArch Consultants · Dubai, United Arab Emirates · Minutes recorded by {meeting.author}
      </div>
    </div>
  );
}
