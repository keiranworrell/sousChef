import tseslint from "typescript-eslint";

export default tseslint.config(
  // Ignore patterns applied globally
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      // apps/web lints via `next lint` with its own config
      "apps/web/**",
    ],
  },
  // TypeScript rules for all other workspaces
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.recommended],
    rules: {
      // No any — enforced as an error to match the project convention
      "@typescript-eslint/no-explicit-any": "error",
      // Allow intentionally unused args/vars when prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
