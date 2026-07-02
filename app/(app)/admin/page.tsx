import { redirect } from "next/navigation";
import { isCurrentUserFounder } from "@/lib/server/founder";
import { listCompaniesForAdmin } from "@/lib/server/admin";
import { AdminCompanies } from "@/components/admin/admin-companies";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isCurrentUserFounder())) redirect("/dashboard");
  const companies = await listCompaniesForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Companies & licenses</h2>
        <p className="mt-1 text-sm text-muted">
          Every tenant on AEC-flow. Edit a company&rsquo;s plan, seats, and access window.
        </p>
      </div>
      <AdminCompanies companies={companies} />
    </div>
  );
}
