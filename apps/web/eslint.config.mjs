import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // <img> is intentional — images come from external CDNs (S3/CloudFront, recipe sites)
      // that aren't configured as Next.js image domains; using next/image would require listing
      // every possible source. Revisit if we standardise on a single CDN domain.
      "@next/next/no-img-element": "off",
      // exhaustive-deps: pre-existing pattern across the codebase; not a runtime issue
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
