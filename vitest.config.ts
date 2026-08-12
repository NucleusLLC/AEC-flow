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
    ],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
