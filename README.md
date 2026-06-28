# ZenArch — AEC Management Suite

An internal management suite for an Architecture / Engineering / Construction practice (UAE, AED).
Covers the full business flow: **Clients → Proposals → Orders → Projects** (with phases), plus **Team**, **Leave**, and **Settings**.

Built with **Next.js 16** (App Router, React 19), **Prisma 7** (Postgres via driver adapter), **Tailwind v4**, `next-auth`, `react-hook-form` + `zod`, `recharts`.

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

> ⚠️ This is a customised Next.js — see `AGENTS.md`. Read the relevant guide in
> `node_modules/next/dist/docs/` before changing framework-level code. Notably,
> route `params`/`searchParams` are **async** (`await params`).

---

## Current state (overnight build)

The UI is **feature-complete on placeholder data**. No database is connected yet —
every page reads from `lib/data/*.ts` which currently return realistic in-memory data.
**Connecting Supabase is the next step → see [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).**

### Modules (all live with real pages)
| Route | What's there |
| --- | --- |
| `/dashboard` | Stat tiles, active projects, pipeline, activity, out-of-office (composed from the other data getters) |
| `/clients`, `/clients/[id]` | List (search/filter/sort) + detail (proposals, projects, contacts, addresses, activity) |
| `/proposals`, `/proposals/[id]`, `/proposals/new`, `/proposals/[id]/edit` | Pipeline list + detail (line items/milestones) + create/edit forms |
| `/orders`, `/orders/[id]` | Order list + detail |
| `/projects`, `/projects/[id]` | Delivery list + detail (phases, team, progress) |
| `/team`, `/team/[id]` | People directory + member detail |
| `/leave` | Requests, who's-out, public holidays |
| `/settings` | Practice profile · proposal templates · members & roles · preferences |
| `/search` | Global search across clients/projects/proposals/orders/team |

Plus: group-level **loading skeletons**, **error** + **404 boundaries**, and a **mobile nav** drawer.

---

## Architecture

```
app/(app)/<module>/page.tsx        server component → fetches lib/data, renders view
app/(app)/<module>/[id]/page.tsx   detail (async params)
components/<module>/<module>-view  "use client" — search / filter / sort / table
components/<module>/badges.tsx     module-specific status colours
components/ui/*                    Card, Badge/StatusBadge/PriorityBadge, ProgressBar
lib/data/<module>.ts               ⭐ the ONLY data source — swap to Prisma here
lib/format.ts, lib/utils.ts        AED/date formatting, cn(), initials()
lib/db.ts                          Prisma client (driver adapter, pooled DATABASE_URL)
prisma/schema.prisma               full domain model + enums
```

**The data-layer rule (single-tenant → SaaS hedge):** pages/components NEVER touch Prisma.
They only call `lib/data/<module>.ts`. When the DB goes live, swap those function bodies
(keeping the same signatures/return types) and the UI doesn't change. When multi-tenant,
`orgId` scoping is added in those getters and nowhere else.

Design tokens live in `app/globals.css` (`@theme`): `bg-surface`, `text-fg/muted/faint`,
`border-border`, `bg-brand/text-brand-fg`, `--radius-card`, the dark "blueprint" sidebar.

---

## Scripts
```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

## Docs
- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — morning runbook: Supabase → migrate → swap data layers to Prisma.
- [`COORDINATION.md`](./COORDINATION.md) — overnight multi-session build log / ownership map.
- `AGENTS.md` — framework caveats for code changes.
