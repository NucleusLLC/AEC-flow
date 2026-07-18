import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { currentCompanyId } from "@/lib/server/request-company";

// Prisma 7 requires a driver adapter for the connection. The connection URL
// lives in the env (also referenced by prisma.config.ts for Migrate).
const connectionString = process.env.DATABASE_URL;

/**
 * MULTI-TENANCY. Every company-owned model carries `companyId`. This Prisma
 * client extension injects the current company's filter into every read/write
 * so one tenant can never see or touch another's data — in ONE place instead of
 * hundreds of call sites.
 *
 * `currentCompanyId()` returns `undefined` outside a request (scripts, seeds,
 * build) → we DON'T scope then, so admin tooling keeps full access.
 */
const TENANT_MODELS = new Set<string>([
  "Client", "Proposal", "ProposalTemplate", "Order", "Project", "MeetingMinute",
  "LeaveRequest", "CaReport", "ChangeOrder", "RfiLog", "SiteInstruction",
  "SubmittalLog", "DelayNotice", "ProgressCertification", "PunchListItem",
  "DevelopmentProject", "CostEstimate", "ProjectSchedule", "PriceItem",
  "NormSetTask", "Vendor", "GeneralConditionItem", "EstimateTemplate",
  "WikiArticle", "Task", "ActivityLog", "GeneratedDocument", "PurchaseOrder",
  "MaterialSelection", "DesignDeliverable",
]);

type WhereObj = Record<string, unknown> | undefined;

async function scopedWhere(where: WhereObj): Promise<WhereObj> {
  const cid = await currentCompanyId();
  if (cid === undefined) return where; // not a request → no scoping (scripts/build)
  const scope = { companyId: cid };
  return where ? { AND: [where, scope] } : scope;
}

const baseClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

const createPrismaClient = () =>
  baseClient().$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async count({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) args.where = await scopedWhere(args.where as WhereObj);
          return query(args);
        },
        // findUnique's where must be unique, so we can't add companyId to it —
        // instead we guard the returned row (return null if it's another tenant's).
        async findUnique({ model, args, query }) {
          const row = await query(args);
          if (!TENANT_MODELS.has(model) || !row) return row;
          const cid = await currentCompanyId();
          if (cid === undefined) return row;
          return (row as { companyId?: string | null }).companyId === cid ? row : null;
        },
        async create({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const cid = await currentCompanyId();
            const data = args.data as Record<string, unknown> | undefined;
            if (cid && data && data.companyId === undefined) data.companyId = cid;
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const cid = await currentCompanyId();
            if (cid && args.data) {
              const rows = (Array.isArray(args.data) ? args.data : [args.data]) as Record<string, unknown>[];
              for (const r of rows) if (r.companyId === undefined) r.companyId = cid;
            }
          }
          return query(args);
        },
        // Single-row writes: add companyId to the unique where (Prisma
        // extendedWhereUnique). Targeting another tenant's row by id then yields
        // "record not found" instead of mutating it.
        async update({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const cid = await currentCompanyId();
            if (cid !== undefined && args.where) (args.where as Record<string, unknown>).companyId = cid;
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const cid = await currentCompanyId();
            if (cid !== undefined && args.where) (args.where as Record<string, unknown>).companyId = cid;
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const cid = await currentCompanyId();
            if (cid !== undefined && args.where) (args.where as Record<string, unknown>).companyId = cid;
            if (cid) {
              const create = args.create as Record<string, unknown> | undefined;
              if (create && create.companyId === undefined) create.companyId = cid;
            }
          }
          return query(args);
        },
        async findUniqueOrThrow({ model, args, query }) {
          const row = await query(args);
          if (!TENANT_MODELS.has(model) || !row) return row;
          const cid = await currentCompanyId();
          if (cid === undefined) return row;
          if ((row as { companyId?: string | null }).companyId !== cid) {
            throw new Error(`No ${model} found for this company`);
          }
          return row;
        },
      },
    },
  });

// Reuse the client across hot-reloads in development to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
