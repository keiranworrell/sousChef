import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "dist/**", "drizzle.config.ts"],
    },
  },
});
