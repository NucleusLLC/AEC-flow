import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Unit tests for the Service Proposal domain layer.
 *
 * SCOPE — deliberately narrow. Two test conventions coexist in this repository:
 *   1. `node:test` suites run via `npx tsx --test` — lib/calc/rebar.test.ts,
 *      lib/development/calc.test.ts. Pre-existing; NOT owned by this module.
 *   2. Vitest — this module (lib/proposals/**), added for the fee engine.
 *
 * The include glob is restricted to lib/proposals so Vitest never tries to collect the
 * node:test files (it finds no suite in them and fails). Consolidating the two conventions
 * is worth doing, but it is a separate change to code this module does not own.
 *
 * These modules have no I/O, no Prisma and no React, so no environment setup is needed.
 * Integration and end-to-end testing are separate concerns — see
 * docs/proposal-module/06-TEST-PLAN.md §2 and §4.
 *
 * The existing `npm run golden` / `verify:calc` regression scripts are unaffected.
 */
export default defineConfig({
  test: {
    // Files are named explicitly rather than broadened to `lib/**`: a wider glob
    // would collect the node:test suites described above, which Vitest can't run.
    include: [
      "lib/proposals/**/*.test.ts",
      "lib/firm-identity.test.ts",
      "lib/documents/**/*.test.ts",
      // Named file, not a `lib/schedule/**` sweep: the schedule module's other
      // code is protected and untested, and a directory glob here would be the
      // first step toward re-collecting the node:test suites described above.
      "lib/schedule/display-prefs.test.ts",
      "lib/schedule/budget.test.ts",
      // Drawing intake: named files for the same reason as the two above.
      "lib/drawings/extraction.test.ts",
      "lib/drawings/intake.test.ts",
      "lib/drawings/storage-key.test.ts",
      // Re-proposal: what happens to a half-filled intake form when the
      // server's title-block reading lands after the filename's. Named file,
      // same reason as those above.
      "lib/drawings/proposal.test.ts",
      // Dashboard background manifest: named file, same reason as those above.
      "lib/dashboard/backgrounds.test.ts",
      // Section-aware backgrounds — the route→section resolver and the
      // per-section manifests. Named file, same reason as those above.
      "lib/dashboard/sections.test.ts",
      // Card transparency ladder + the validation that stands between the
      // free-form preferences blob and a CSS custom property. Named file, same
      // reason as every entry above.
      "lib/dashboard/glass.test.ts",
      // Password policy + the password-management role gate: named file, same
      // reason as those above. Pure module — no Prisma, no session, no bcrypt.
      "lib/password-policy.test.ts",
      // The findUnique tenant-scope tripwire: a static scan of lib/ and app/ for a
      // tenant-model findUnique whose `select` omits companyId (which makes the
      // extension's row-guard reject every row for every signed-in user). Named
      // file, same reason as those above — it reads source off disk, so it needs
      // no database and belongs in this pure-unit suite.
      "lib/tenant-scope-findunique.test.ts",
      // The honest-progress arithmetic behind <ProgressLoader />: stage weighting,
      // the cap that stops the bar reaching 100% before the work is done, and the
      // elapsed-time smoother. Named file, same reason as every entry above —
      // pure module, no React, no Prisma, no DOM.
      "lib/ui/progress-loader.test.ts",
      // Outbound document email. Four named files, same reason as every entry
      // above. None of them touches the network or the database: the two
      // lib/email modules are pure, and the other two mock their I/O at the
      // module edge — `@/lib/server/email` (the Resend wrapper) and `@/lib/db`
      // respectively. That matters more than usual here: RESEND_API_KEY is
      // empty in production, so a real send cannot be exercised anywhere, and
      // the database these would otherwise reach IS production.
      "lib/email/recipients.test.ts",
      "lib/email/compose.test.ts",
      // The transport itself: what counts as sent, and which environment states
      // refuse to send at all. Named file, same reason as every entry above --
      // it mocks `resend` at the SDK constructor and `server-only` (which Next
      // supplies and Vitest cannot resolve), so it reaches no network.
      "lib/server/email.test.ts",
      "lib/server/document-email.test.ts",
      "lib/data/email-log.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
