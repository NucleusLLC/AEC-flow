/**
 * Seeds a brand-new company with a little sample data so it isn't an empty shell
 * on first login. Every row carries the company's id explicitly (the tenant
 * extension only auto-fills companyId when it's omitted). Kept to models with no
 * required relations so it can't fail. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";

export async function seedCompany(companyId: string): Promise<void> {
  try {
    await prisma.client.createMany({
      data: [
        { companyId, name: "Acme Development", companyName: "Acme Development LLC", type: "DEVELOPER", status: "ACTIVE", contactPerson: "Sample Contact", email: "contact@acme.example" },
        { companyId, name: "City Housing Authority", companyName: "City Housing Authority", type: "GOVERNMENT", status: "ACTIVE" },
        { companyId, name: "Riverside Villa", type: "PRIVATE", status: "PROSPECT" },
      ],
    });
    await prisma.task.createMany({
      data: [
        { companyId, title: "Welcome — this is your company workspace", status: "TODO", priority: "MEDIUM" },
        { companyId, title: "Add your first real client", status: "TODO", priority: "HIGH" },
        { companyId, title: "Create a cost estimate", status: "IN_PROGRESS", priority: "MEDIUM" },
        { companyId, title: "Explore the Schedule Gantt", status: "TODO", priority: "LOW" },
      ],
    });
  } catch (e) {
    // Seeding is best-effort — never block signup on it.
    console.error("[company-seed] failed for", companyId, e);
  }
}
