/**
 * Bundles all Lambda handlers into single-file JS outputs using esbuild.
 * Output: backend/dist/lambda/<name>.js
 *
 * Run: pnpm bundle:lambdas
 * CI:  called by the Terraform workflow before terraform plan/apply
 */

import { build } from "esbuild";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outdir = resolve(root, "dist/lambda");

mkdirSync(outdir, { recursive: true });

/** Add an entry here for each Lambda handler that gets deployed. */
const entryPoints = [
  {
    in: resolve(root, "triggers/cognito-post-confirmation.ts"),
    out: "cognito-post-confirmation",
  },
  {
    in: resolve(root, "functions/recipes.ts"),
    out: "recipes",
  },
  {
    in: resolve(root, "functions/pantry.ts"),
    out: "pantry",
  },
  {
    in: resolve(root, "functions/shopping.ts"),
    out: "shopping",
  },
  {
    in: resolve(root, "functions/mealplans.ts"),
    out: "mealplans",
  },
  {
    in: resolve(root, "functions/fermentation.ts"),
    out: "fermentation",
  },
  {
    in: resolve(root, "functions/community.ts"),
    out: "community",
  },
];

for (const entry of entryPoints) {
  console.log(`Bundling ${entry.out}...`);
  await build({
    entryPoints: [entry.in],
    outfile: resolve(outdir, `${entry.out}.js`),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    // AWS SDK v3 is provided by the Lambda runtime — exclude to keep bundle small
    external: ["@aws-sdk/*"],
    sourcemap: false,
    minify: false,
  });
  console.log(`  → dist/lambda/${entry.out}.js`);
}

console.log("Bundle complete.");
