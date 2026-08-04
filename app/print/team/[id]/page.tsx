import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { getTeamMember } from "@/lib/data/team";
import { ROLE_LABEL, DISCIPLINE_LABEL, DEPARTMENT_LABEL } from "@/lib/data/team.types";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const m = await getTeamMember(id);
  return { title: m ? `${m.name} — Team Member` : "Team Member" };
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}

export default async function TeamMemberSheet({ params }: PageProps) {
  const { id } = await params;
  const [m, practice] = await Promise.all([getTeamMember(id), getPracticeSettings()]);
  if (!m) notFound();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  return (
    <PrintSurface backHref={`/team/${m.id}`} backLabel="Back to member">
      <DocumentLetterhead
        logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
        name={companyName}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Team Member</div>
          </div>
        }
      />

      <h1 className="mt-5 text-xl font-bold text-gray-900">{m.name}</h1>
      <p className="mt-0.5 text-gray-600">{ROLE_LABEL[m.role]}{m.discipline ? ` · ${DISCIPLINE_LABEL[m.discipline]}` : ""}</p>

      <div className="mt-5 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
        <Meta label="Email" value={m.email} />
        <Meta label="Phone" value={m.phone || "—"} />
        <Meta label="Department" value={DEPARTMENT_LABEL[m.department]} />
        <Meta label="Office" value={m.officeLocation || "—"} />
        <Meta label="Status" value={m.status.replace(/_/g, " ")} />
        <Meta label="Capacity" value={`${m.capacity}%`} />
        <Meta label="Utilisation" value={`${m.utilisation}%`} />
        <Meta label="Joined" value={m.joiningDate ? formatDate(m.joiningDate) : "—"} />
        <Meta label="Active Projects" value={String(m.activeProjects)} />
        <Meta label="Annual Leave" value={`${m.annualLeaveTaken}/${m.annualLeaveTotal} taken`} />
      </div>

      {m.bio ? (
        <div className="mt-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bio</h2>
          <p className="mt-1 text-gray-700">{m.bio}</p>
        </div>
      ) : null}

      {m.skills.length ? (
        <div className="mt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Skills</h2>
          <p className="mt-1 text-gray-700">{m.skills.join(" · ")}</p>
        </div>
      ) : null}

      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Current Projects</h2>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">Project</th>
            <th className="py-2 font-semibold">Role</th>
          </tr>
        </thead>
        <tbody>
          {m.currentProjects.length ? (
            m.currentProjects.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-900">{p.name}</td>
                <td className="py-1.5 text-gray-600">{p.role}</td>
              </tr>
            ))
          ) : (
            <tr><td className="py-3 text-gray-400" colSpan={2}>No current project assignments.</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {companyName} · {m.name} · {ROLE_LABEL[m.role]}
      </div>
    </PrintSurface>
  );
}
