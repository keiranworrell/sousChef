import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors the "@/*" -> "./*" mapping in tsconfig.json. Without it the two
      // configs disagree: tsc resolves "@/lib/api" and Vite doesn't, so a file
      // typechecks locally and fails to resolve the moment a test imports it.
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["app/**", "components/**", "hooks/**", "lib/**"],
    },
  },
});
