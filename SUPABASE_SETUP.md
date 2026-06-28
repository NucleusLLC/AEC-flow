# 🌅 Morning runbook — wire the AEC Suite to Supabase

Goal: flip the suite from in-memory **placeholder data** to a live **Supabase Postgres** via Prisma, **without changing any page or component**. Every page already calls `lib/data/<module>.ts`; we only swap those function bodies.

> Authored by **[CC3]** overnight. Do these steps top-to-bottom with the user at ~11am. Nothing here was run (the Supabase host didn't resolve overnight — see step 1).

---

## 0. Pre-flight (state as left overnight)
- Stack: **Next 16 + React 19 + Prisma 7** with the **driver-adapter** model (`@prisma/adapter-pg` + `pg`), Tailwind v4.
- `lib/db.ts` → builds `PrismaClient` with `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (the **pooled** URL).
- `prisma.config.ts` → Migrate/Studio use `process.env.DIRECT_URL` (the **direct** URL).
- `prisma/schema.prisma` → full domain modelled. **No migration has run yet** (`prisma/migrations/` is empty).
- All `lib/data/*.ts` return placeholder arrays. Dev server runs on **:3000**.

---

## 1. Create / unpause the Supabase project & get connection strings
1. In the Supabase dashboard → create (or unpause) the project. Wait until it's **Active**.
2. Project → **Connect** → **ORMs / Prisma**. Copy both:
   - **Transaction pooler** (port **6543**) → app runtime (`DATABASE_URL`).
   - **Direct connection** (port **5432**) → migrations (`DIRECT_URL`).

## 2. Fill `.env` (mind the encoding gotchas [CC] hit overnight)
```dotenv
# Pooled — app runtime. Append pgbouncer params for the pooler:
DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
# Direct — Prisma Migrate / Studio:
DIRECT_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```
- **URL-encode special chars in the password**: `$`→`%24`, `@`→`%40`, `#`→`%23`, `&`→`%26`, etc. A literal `@` in the password breaks the host parse (this bit [CC] overnight).
- DB name must be `postgres` (not `postgrespostgres`).
- Keep the values quoted.

## 3. Generate client + run the first migration
```bash
npx prisma generate
npx prisma migrate dev --name init        # uses DIRECT_URL via prisma.config.ts
npx prisma studio                         # optional: eyeball the empty tables
```
If `migrate dev` can't connect, it's almost always the URL encoding (step 2) or the project still warming up.

## 4. Seed representative data (recommended)
The placeholder arrays already ARE a realistic dataset — lift them into a seed so the UI looks identical post-cutover.
1. Create `prisma/seed.ts` that inserts: a few `User`s (see `lib/data/settings.ts` members + roles), `Client`s + `ClientAddress`es (`lib/data/clients.ts`), `Proposal`s/`ProposalLineItem`/`ProposalMilestone`, `Order`s, `Project`s/`ProjectPhase`/`PhaseAssignment`, `LeaveRequest`s, `PublicHoliday`s, `ProposalTemplate`s.
2. Run it (`ts-node` is already a devDependency):
   ```bash
   npx ts-node prisma/seed.ts        # or: npx tsx prisma/seed.ts
   ```
   Or register it in `prisma.config.ts` under a `migrations.seed` command and let `migrate dev` call it.

## 5. Swap the data layer — one module at a time, shape-for-shape
**Rule:** keep every exported function name, signature, and return TYPE identical. Only the body changes. Pages/components never change. Verify each module (curl its route) before moving to the next.

Order (low-risk → high): `settings → team → leave → clients → projects → proposals → orders → dashboard`.

### Worked example — `lib/data/clients.ts`
```ts
import { prisma } from "@/lib/db";

export async function getClients(): Promise<ClientListItem[]> {
  const rows = await prisma.client.findMany({
    // orgId scope goes HERE when multi-tenant (see §7)
    include: {
      addresses: true,
      _count: { select: { projects: true, proposals: true } },
      proposals: { select: { status: true, totalFee: true } },
      projects:  { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((c): ClientListItem => {
    const primary = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];
    const open = (s: string) => ["DRAFT", "SENT", "PENDING", "ON_HOLD"].includes(s);
    return {
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      type: c.type,
      status: c.status,
      location: primary ? [primary.city, primary.emirate].filter(Boolean).join(", ") : "—",
      tags: c.tags,
      projectsCount: c._count.projects,
      activeProjects: c.projects.filter((p) => p.status === "ACTIVE").length,
      proposalsCount: c._count.proposals,
      openProposals: c.proposals.filter((p) => open(p.status)).length,
      lifetimeValue: c.proposals.filter((p) => p.status === "APPROVED").reduce((n, p) => n + Number(p.totalFee), 0),
      pipelineValue: c.proposals.filter((p) => open(p.status)).reduce((n, p) => n + Number(p.totalFee), 0),
      lastActivityDate: c.updatedAt.toISOString().slice(0, 10),
      createdAt: c.createdAt.toISOString().slice(0, 10),
    };
  });
}
```
Notes that bite:
- **`Decimal` → number:** wrap money fields in `Number(...)` (Prisma returns `Decimal` for `totalFee`, `fee`, `amount`). The UI types expect `number`.
- **`Date` → string:** the data-layer types use ISO strings; call `.toISOString().slice(0,10)` (or pass `Date` and adjust `lib/format.ts` — but keeping strings means zero UI churn).
- **Enums already line up** with the schema (we mirrored `ClientType`, `ProjectStatus`, etc.), so they map 1:1.
- `getClient(id)` → `prisma.client.findUnique({ where: { id }, include: { addresses, contacts (none in schema — see §6), proposals, projects, activityLogs } })`, then shape to `ClientRecord`.

### Module → Prisma model map
| `lib/data/*` | Primary model(s) | Notes |
| --- | --- | --- |
| `clients.ts` | `Client` (+`ClientAddress`, counts from `Proposal`/`Project`) | `contacts[]` has **no model** — see §6 |
| `proposals.ts` | `Proposal` (+`ProposalLineItem`,`ProposalMilestone`), `Client`, `User` | money = `Decimal`→`Number` |
| `orders.ts` | `Order`, `Client`, `Proposal`, `Project` | one-to-one `Order↔Project` |
| `projects.ts` | `Project` (+`ProjectPhase`,`PhaseAssignment`), `Client`, `User` | progress can stay stored or be derived from phases |
| `team.ts` | `User` (+`LeaveRequest`,`PhaseAssignment`) | capacity/utilisation derived |
| `leave.ts` | `LeaveRequest`, `User`, `PublicHoliday` | — |
| `settings.ts` | `ProposalTemplate`, `User`(members/roles) | **practice profile + preferences have NO model** — see §6 |
| `dashboard.ts` | composes the getters above | already composed; just inherits live data |

## 6. Schema gaps to close before/while wiring (decide with the user)
These exist in the **UI** but not in `schema.prisma`:
- **Client `contacts[]`** (key contacts) — clients detail shows them. Add a `ClientContact` model, or fold into `ClientAddress`/notes.
- **Practice profile + Preferences** (`settings.ts`) — no `Organization`/`OrgSettings` model. Add one (also the natural home for the future `orgId`), or keep these as env/config and have `settings.ts` read a singleton row.
- **Activity "at" / relative times** — UI uses human strings ("2 hours ago"); from DB, format `createdAt` with `date-fns` `formatDistanceToNow`.

Add models → edit `schema.prisma` → `npx prisma migrate dev --name <change>`.

## 7. Multi-tenant hedge (when you're ready, not required for v1)
The data layer is the single choke point — exactly as designed. To go multi-tenant:
1. Add `Organization` + `orgId` FK to top-level models (`Client`, `Proposal`, `Order`, `Project`, `User`, …).
2. Add `where: { orgId }` in each `lib/data/*` getter (resolve `orgId` from the session/`next-auth`).
3. Nothing else changes — pages/components stay put.

## 8. Verify the cutover
```bash
npx tsc --noEmit                 # types still satisfied after each module swap
npm run lint
# with dev server on :3000:
for r in dashboard clients projects proposals orders team leave settings; do
  printf "%-10s " "$r"; curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/$r"; done
```
Each route should stay **200** and now render **live** data. Spot-check a detail page (`/clients/<realId>`) and a bad id (should hit the branded 404 boundary).

---
**Rollback:** the placeholder bodies are in git history — if a module's query misbehaves, revert just that one `lib/data/<m>.ts` to keep the demo green while you debug.
