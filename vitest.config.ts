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
    include: ["lib/proposals/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
