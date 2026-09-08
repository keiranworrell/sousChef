import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the completeness of the GDPR data export.
 *
 * The failure mode this exists to catch is quiet: someone adds a table that
 * references users.id, never touches export-queries.ts, and the export silently
 * stops being complete. Nothing breaks, no test fails, and we only find out if a
 * user exercises their access right and notices something missing.
 *
 * So rather than testing the query output — which would need a database — this
 * reads the schema directory, finds every table with a foreign key to users.id,
 * and asserts the export file references it. Crude, but it fails loudly at
 * exactly the moment someone would otherwise forget.
 */

const SCHEMA_DIR = join(__dirname, "..", "schema");
const EXPORT_FILE = join(__dirname, "export-queries.ts");

/**
 * Tables intentionally excluded, with the reason. Anything not listed here and
 * not referenced by the export will fail the test.
 */
const INTENTIONALLY_EXCLUDED: Record<string, string> = {
  // Join table — its contents are exported nested inside `collections`
  collectionItems: "exported nested under collections",
  // Join/child tables exported nested under their parent
  recipeIngredients: "exported nested under recipes",
  recipeSteps: "exported nested under recipes",
  recipeTags: "exported nested under recipes",
  pantryItemNotes: "exported nested under pantry",
  shoppingListItems: "exported nested under shoppingLists",
  mealPlanEntries: "exported nested under mealPlans",
  fermentationLogs: "exported nested under fermentationBatches",
  // Households themselves belong to a group, not a user; the user's membership
  // is what's personal to them and that is exported via householdMembers.
  households: "group-owned; membership exported via householdMembers",
  householdInvites: "group-owned; not personal data of this user",
  // The account row is exported as `account`
  users: "exported as `account`",
};

function tablesReferencingUsers(): string[] {
  const found: string[] = [];

  for (const file of readdirSync(SCHEMA_DIR)) {
    if (!file.endsWith(".ts") || file === "index.ts") continue;
    const src = readFileSync(join(SCHEMA_DIR, file), "utf8");

    // Split on table declarations so each chunk holds one table's columns
    const chunks = src.split(/export const (\w+) = pgTable/).slice(1);
    for (let i = 0; i < chunks.length; i += 2) {
      const name = chunks[i];
      const body = chunks[i + 1] ?? "";
      if (name && /references\(\(\)\s*=>\s*users\.id/.test(body)) {
        found.push(name);
      }
    }
  }
  return found;
}

describe("GDPR data export completeness", () => {
  const exportSrc = readFileSync(EXPORT_FILE, "utf8");
  const tables = tablesReferencingUsers();

  it("finds tables to check (guards against the detection itself breaking)", () => {
    // If the schema format changes and the regex stops matching, every
    // assertion below would vacuously pass. This makes that failure visible.
    expect(tables.length).toBeGreaterThan(5);
  });

  it.each(tablesReferencingUsers())(
    "%s is either exported or explicitly excluded",
    (table) => {
      const isExcluded = table in INTENTIONALLY_EXCLUDED;
      const isReferenced = new RegExp(`\\b${table}\\b`).test(exportSrc);

      expect(
        isExcluded || isReferenced,
        `Table "${table}" references users.id but is neither imported by ` +
          `export-queries.ts nor listed in INTENTIONALLY_EXCLUDED. A GDPR ` +
          `export that omits data does not satisfy the access right — either ` +
          `add it to exportUserData, or add it to the exclusion list with a reason.`,
      ).toBe(true);
    },
  );
});
