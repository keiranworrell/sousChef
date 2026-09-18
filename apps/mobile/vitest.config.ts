import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * apps/mobile was the only workspace without a test runner, so CLAUDE.md's rule
 * about covering utility functions had nowhere to apply here.
 *
 * Node environment, not jsdom: this runs pure logic only. React Native
 * components need a native runtime that neither environment provides, and
 * pretending otherwise with a DOM would invite tests that pass while telling us
 * nothing about a phone.
 */
export default defineConfig({
  resolve: {
    alias: {
      /**
       * Metro and tsc both resolve this through the workspace link; vitest does
       * not, and finds the built `dist` or nothing at all. Pointing it at source
       * means a test exercises the same code the app bundles.
       *
       * Until now every mobile lib module imported only *types* from shared,
       * which vanish at compile time, so nothing needed resolving at runtime and
       * this was never missed. `recent-days.ts` is the first to import a
       * function. The same gap cost a CI run on `@/lib/api`.
       */
      "@souschef/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["lib/**/*.test.ts"],
  },
});
