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
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["lib/**/*.test.ts"],
  },
});
