# System Currency

> **Status:** Active. Describes how AEC-Flow decides which monetary unit to print.
> Written alongside commit `53a180a` (`fix(currency): respect the configured system
> unit everywhere (AED -> AWG)`), which removed the hardcoded UAE assumptions.

The practice's unit is **AWG** (Aruban florin). Nothing in the app should hardcode
that — every money figure resolves the unit at render time, so changing the setting
changes the whole app.

---

## 1. How the System Currency resolves

There is one authoritative resolver, on the server:

**`getSystemCurrency()` — `lib/server/practice-config.ts`**

```
DB AppConfig row (.currency)   →   process.env.SYSTEM_CURRENCY   →   DEFAULT_SYSTEM_CURRENCY
        (what the UI writes)          (serverless fallback)             (last resort: "AWG")
```

1. **DB `AppConfig`** — the value saved in *Settings → Practice → System Currency*.
   It lives in the `AppConfig` JSON blob (`lib/server/app-config-store.ts`), one row
   per company (keyed by `companyId`, falling back to the legacy `"singleton"` row).
   This used to be a gitignored `.app-config.json`; it moved to Postgres because
   serverless filesystems aren't writable, which silently lost the setting on Vercel.
2. **`SYSTEM_CURRENCY` env var** — used when the config blob has no `currency` key
   (fresh deployment, unreachable DB). See §5.
3. **`DEFAULT_SYSTEM_CURRENCY`** — the compiled-in last resort, `"AWG"`, exported
   from `lib/server/practice-config.ts`.

`saveSystemCurrency()` in the same file is the only writer; it validates a 3-letter
ISO code and upper-cases it.

### Per-record currency always wins

A `Proposal`, `Order`, `Project`, `ServiceProposal`, … each stores its **own**
`currency` column. That is deliberate: a proposal quoted in USD must keep printing
USD forever, even after the org switches units. The System Currency is only the
*default* — for new records, and for aggregate/dashboard figures that belong to no
single record.

This is also why changing the setting does **not** retro-fix old data. See §4.

---

## 2. The client/server split, and the RSC cold-render caveat

Money is formatted by `lib/format.ts` — `formatCurrency()`, `formatCurrencyCompact()`
— which is imported by **both** server and client components. It cannot read the
database (client components have no Prisma), so it keeps a **module-global**:

```ts
let SYSTEM_CURRENCY = ENV_SYSTEM_CURRENCY ?? "AWG";
export function setSystemCurrency(currency) { … }
export function getSystemCurrency() { … }
```

Single-tenant today, so a module global is the right fit. It is seeded twice per
request:

| Where | What runs | Covers |
|---|---|---|
| `app/(app)/layout.tsx` | `setSystemCurrency(await getSystemCurrency())` | server-rendered money for the rest of the request |
| `components/shell/system-currency-init.tsx` (`<SystemCurrencyInit>`) | `setSystemCurrency(currency)` in the client bundle | everything the browser formats after hydration |
| `app/print/directory/[entity]/page.tsx` | seeds it explicitly | print routes live outside `(app)`, so the layout never runs |

### ⚠ The cold-render ordering caveat

**React Server Components render children before, or interleaved with, the layout.**
On a cold render a page's server component can format money *before*
`app/(app)/layout.tsx` has called `setSystemCurrency`. In that window the module
global is whatever it was initialised to at module load — i.e. the `SYSTEM_CURRENCY`
env value, or `"AWG"`.

Two consequences:

- **Set `SYSTEM_CURRENCY` in the deployment environment** (§5). It is what makes the
  cold-render window print the right unit. This — not the DB value — was the actual
  cause of the "server-rendered pages still say AED" bug: the Vercel env var still
  said `AED`.
- **Keep the two last-resort defaults in step.** `lib/format.ts`'s literal `"AWG"`
  and `DEFAULT_SYSTEM_CURRENCY` in `lib/server/practice-config.ts` must always match.
  Both files carry a comment saying so.

New print routes (anything outside `app/(app)/`) must seed the currency themselves;
copy the pattern in `app/print/directory/[entity]/page.tsx`.

---

## 3. `SYSTEM_LOCALE` — and why it is `en-GB`

`lib/format.ts` exports:

```ts
export const SYSTEM_LOCALE = "en-GB";
```

This is a **locale, not a currency**. It controls digit grouping and date word order;
it never decides which unit is shown. It is used by `formatCurrency`,
`formatCurrencyCompact`, `formatNumber`, `formatDate`, and by a handful of components
that call `toLocaleDateString` directly (`components/schedule/schedule-gantt.tsx`,
`components/schedule/schedule-print.tsx`, `app/print/schedule/[id]/page.tsx`).

It used to be `"en-AE"`, which tied every rendered figure and date to the UAE.
`"en-GB"` was chosen over the alternatives because it is the region-neutral
equivalent **for this app**:

- identical Latin digits and `1,234,567.89` grouping — no visual regression;
- identical `24 Jul 2026` day-first dates, which is also the Aruban convention;
- `"en-US"` would have silently flipped every date in the app to month-first.

It is a single exported constant so a future per-tenant locale setting has exactly
one place to land. Do not reintroduce inline locale strings.

---

## 4. Where `AED` legitimately remains

Grepping for `AED` still returns hits. All of the remaining ones are correct:

### `lib/data/price-lists.types.ts` — real UAE supplier prices

```ts
export const PRICE_CURRENCY = "AED"; // legacy/UAE fallback
export const REGION_CURRENCY: Record<string, string> = { Aruba: "USD", UAE: "AED" };
```

The Materials & Equipment price lists carry two regions. The UAE rows are genuine
quotes from UAE suppliers (Unibeton et al.) and are **actually denominated in AED**.
`currencyOf(item)` resolves per item → per region → fallback. Rewriting these to AWG
would not convert the prices, it would mislabel them. **Leave them alone**, and note
that `scripts/backfill-currency-awg.ts` explicitly excludes `price_items`.

### `OTHER_CURRENCIES` picker arrays

```
components/settings/practice-form.tsx          ["AWG","AED","USD","EUR","GBP","SAR","ANG","COP"]
components/construction-admin/cert-form.tsx    ["USD","AED","EUR","ANG","AWG","COP"]
components/construction-admin/change-order-form.tsx  (same)
components/proposals/proposal-form.tsx         ["AED","USD","EUR","GBP"]
```

These are **dropdown option lists**, not defaults. They are passed through
`currencyOptions(OTHER_CURRENCIES)` from `lib/format.ts`, which puts the *configured*
System Currency first and de-duplicates. AED belongs in the list for the same reason
USD and EUR do: the practice may still need to quote a job in it, and historic AED
records must remain editable without their own currency vanishing from the picker.

---

## 5. Deployment: the `SYSTEM_CURRENCY` env var

**Optional but recommended.** Without it the app still resolves AWG (via the DB row,
and via the compiled-in default), but the RSC cold-render window in §2 will use the
compiled default rather than an explicitly configured value.

| | |
|---|---|
| Name | `SYSTEM_CURRENCY` |
| Value | `AWG` |
| Where | Vercel → project **AEC-flow** → Settings → Environment Variables |
| Environments | Production, Preview, Development |
| Type | Plain (not a secret) |
| Also | `.env` for local development (documented in `.env.example`) |

Format: a bare 3-letter ISO code, no quotes, no whitespace. Both readers validate
`/^[A-Za-z]{3}$/` and upper-case it; anything else is ignored and the fallback applies.

Changing it requires a **redeploy** — it is read at module load, not per request.

> Historic note: this var was set to `AED` in production, which is why
> server-rendered totals kept showing AED even after the DB setting was AWG.

---

## 6. Changing the System Currency in future

1. **Settings → Practice → System Currency** in the running app. This writes the DB
   `AppConfig` row and takes effect immediately, per request, no deploy. For most
   purposes this is the whole job.
2. **Update `SYSTEM_CURRENCY` on Vercel** to the same code and redeploy, so the
   cold-render fallback agrees with the setting (§2). Skipping this leaves a window
   where server-rendered figures print the old unit.
3. **Consider the schema defaults.** `Proposal`, `Order`, `Project` carry
   `@default("AWG")` in `prisma/schema.prisma`. These only matter for rows inserted
   without an explicit currency. To move them, edit the schema and generate SQL
   *without applying it*:

   ```bash
   npx prisma migrate diff \
     --from-schema <previous schema>.prisma \
     --to-schema prisma/schema.prisma \
     --script
   ```

   Save the output as the next numbered file in `prisma/sql/` (the repo applies these
   by hand — there is no `prisma/migrations` directory and no `prisma migrate deploy`
   step). Precedent: `prisma/sql/0006_currency_defaults_awg.sql`.

4. **Decide about existing rows.** Defaults never touch stored data. If old records
   should be relabelled, use `scripts/backfill-currency-awg.ts`:

   ```bash
   # dry run — reports counts per table, writes nothing
   npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register \
     scripts/backfill-currency-awg.ts

   # write
   npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register \
     scripts/backfill-currency-awg.ts --apply
   ```

   It accepts `--from=XXX` / `--to=XXX`, only touches rows whose currency is exactly
   the `--from` code, is safe to run twice, and never writes to `price_items`.

   **This is a relabel, not a conversion.** It changes the currency *code* on a record;
   it does not multiply any amount by an exchange rate. Only run it on rows whose
   figures were always really in the target unit and were merely tagged wrong.

5. **Do not add new hardcoded codes.** Server code calls
   `getSystemCurrency()` from `lib/server/practice-config.ts`; client/shared code calls
   `getSystemCurrency()` / `formatCurrency()` from `lib/format.ts`; pickers use
   `currencyOptions()`. There is a `SYSTEM_LOCALE`; there is no second locale.
