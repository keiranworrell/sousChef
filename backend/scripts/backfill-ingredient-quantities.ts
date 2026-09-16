/**
 * One-off backfill: split quantities out of ingredient names on existing rows.
 *
 * WHY THIS EXISTS
 *
 * The Schema.org import path never parsed quantities. It put the whole line
 * ("300 g bread flour") into `recipe_ingredients.name` and left `quantity` and
 * `unit` null. The AI and photo importers were worse: their prompts actively
 * *instructed* the model to do the same. Every recipe imported before the fix
 * therefore looks correct on the recipe page and is silently broken everywhere
 * that needs a number — scaling has nothing to scale, and the shopping list
 * cannot add two amounts of flour together because neither has a quantity.
 *
 * Fixing the importers only fixes new imports. This fixes the rows already
 * there.
 *
 * WHAT IT WILL AND WILL NOT TOUCH
 *
 * It only ever considers rows where `quantity IS NULL`. A row that already has
 * a number is left alone, no matter what its name looks like — existing data is
 * never overwritten. On top of that, every proposed change must pass the veto
 * rules in `vet()` below; anything that fails is reported rather than applied,
 * because a wrong quantity is considerably worse than no quantity. Someone
 * reading "a good glug of oil" understands it. Someone reading "2 garlic"
 * does not, and will shop wrong.
 *
 * SAFETY
 *
 * - Dry run is the default. You have to pass --apply to change anything.
 * - Both modes write backfill-ingredients.sql and -rollback.sql so you can read
 *   the exact statements, apply them by hand in the Neon editor instead, or
 *   undo the lot afterwards.
 * - Idempotent. Every UPDATE re-checks `quantity IS NULL`, so running twice is
 *   a no-op and a row changed by someone else in the meantime is skipped.
 * - NOT atomic. The Neon HTTP driver has no multi-statement transaction here,
 *   so --apply runs the updates one at a time. A partial run is harmless (see
 *   idempotent, above) and the rollback file covers a full undo.
 *
 * USAGE
 *
 *   cd backend
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/backfill-ingredient-quantities.ts
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/backfill-ingredient-quantities.ts --apply
 *
 * Flags:
 *   --apply          actually write (default is dry run)
 *   --recipe <uuid>  restrict to a single recipe, for trying it on one first
 *   --limit <n>      cap the number of changes considered
 *   --verbose        print every change, not just a sample
 */

import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";
import { parseIngredient } from "@souschef/shared";

type Row = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  order_index: number;
  recipe_title: string;
  source_url: string | null;
};

type Change = {
  row: Row;
  newName: string;
  newQuantity: number;
  newUnit: string | null;
};

type Rejection = { row: Row; reason: string };

/**
 * Plausibility ceilings, which have to differ by whether a unit was found.
 *
 * A flat ceiling cannot work: "2024 vintage port" and "2000 g flour" both parse
 * to a four-digit number, and 2000 g of flour is an ordinary Saturday. What
 * separates them is the unit. A quantity with no unit is a *count* of things,
 * and counts are small — nobody's recipe calls for 2024 of anything. A quantity
 * with a unit is a measure, and 100 kg expressed in grams is a legitimate
 * fermentation batch.
 */
const MAX_COUNT = 100; // unitless: "2 eggs", "12 cloves"
const MAX_MEASURED = 100_000; // with a unit: grams, millilitres

/** "2 g" is a real ingredient line; "2 g" reduced to a one-letter name is not. */
const MIN_NAME_LENGTH = 2;

/**
 * Decides whether a parse is safe to apply. Returns null if it is, or a reason
 * string if it is not.
 *
 * These rules exist because `parseIngredient` is deliberately permissive about
 * *shape* — it will happily read a number off the front of anything. The rules
 * here are about *plausibility*, which is a different question and one the
 * parser has no business answering.
 *
 * Structural checks run before plausibility ones. Both reject, so the order does
 * not change what gets written — but the reason strings are grouped and read in
 * the dry-run report, and "nothing was split off" is a truer account of a line
 * than "implausible count" when both happen to be true of it.
 */
export function vet(
  row: { name: string; unit: string | null },
  parsed: ReturnType<typeof parseIngredient>,
): string | null {
  if (parsed.quantity === null) return null; // not a rejection — nothing to do
  if (!Number.isFinite(parsed.quantity)) return "quantity is not a finite number";
  if (parsed.quantity <= 0) return "quantity is zero or negative";

  // --- structural: is this a split at all? ---

  const name = parsed.name.trim();
  if (name.length < MIN_NAME_LENGTH) return "parsed name is too short to be an ingredient";

  // The parser is only ever supposed to REMOVE a leading or trailing quantity,
  // never to rewrite the name. If the result is not contained in the original,
  // something in the parser has started inventing text and this backfill should
  // not be the thing that discovers it in production.
  if (!row.name.toLowerCase().includes(name.toLowerCase())) {
    return "parsed name is not contained in the original — parser may have rewritten it";
  }

  // Nothing was actually removed, so there is no quantity to gain. Leaving it
  // alone keeps the row exactly as it is rather than writing a number that was
  // never in the text.
  if (name.length === row.name.trim().length) return "name unchanged — nothing was split off";

  // --- plausibility: do we believe the number? ---

  const unit = parsed.unit ?? row.unit;
  const ceiling = unit ? MAX_MEASURED : MAX_COUNT;
  if (parsed.quantity > ceiling) {
    return unit
      ? `quantity ${parsed.quantity} ${unit} is implausibly large`
      : `quantity ${parsed.quantity} with no unit is implausible as a count — probably a year or a code`;
  }

  // The row has a unit but no quantity, and the text disagrees with the unit.
  // Two sources of truth that contradict each other is exactly the case to
  // leave for a human.
  if (row.unit && parsed.unit && row.unit.toLowerCase() !== parsed.unit.toLowerCase()) {
    return `existing unit "${row.unit}" conflicts with parsed unit "${parsed.unit}"`;
  }

  return null;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function updateStatement(c: Change): string {
  const unit = c.newUnit === null ? "NULL" : quote(c.newUnit);
  return (
    `UPDATE recipe_ingredients SET name = ${quote(c.newName)}, ` +
    `quantity = ${c.newQuantity}, unit = ${unit} ` +
    `WHERE id = '${c.row.id}' AND quantity IS NULL;`
  );
}

function rollbackStatement(c: Change): string {
  const unit = c.row.unit === null ? "NULL" : quote(c.row.unit);
  return (
    `UPDATE recipe_ingredients SET name = ${quote(c.row.name)}, ` +
    `quantity = NULL, unit = ${unit} ` +
    `WHERE id = '${c.row.id}';`
  );
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable is not set");

  const apply = process.argv.includes("--apply");
  const verbose = process.argv.includes("--verbose");
  const recipeFilter = arg("--recipe");
  const limitArg = arg("--limit");
  const limit = limitArg ? Number(limitArg) : Infinity;

  const sql = neon(databaseUrl);

  const rows = (
    recipeFilter
      ? await sql`
          SELECT ri.id, ri.recipe_id, ri.name, ri.quantity, ri.unit, ri.order_index,
                 r.title AS recipe_title, r.source_url
          FROM recipe_ingredients ri
          JOIN recipes r ON r.id = ri.recipe_id
          WHERE ri.quantity IS NULL AND ri.recipe_id = ${recipeFilter}
          ORDER BY r.title, ri.order_index`
      : await sql`
          SELECT ri.id, ri.recipe_id, ri.name, ri.quantity, ri.unit, ri.order_index,
                 r.title AS recipe_title, r.source_url
          FROM recipe_ingredients ri
          JOIN recipes r ON r.id = ri.recipe_id
          WHERE ri.quantity IS NULL
          ORDER BY r.title, ri.order_index`
  ) as Row[];

  const changes: Change[] = [];
  const rejections: Rejection[] = [];
  let leftAlone = 0;

  for (const row of rows) {
    if (changes.length >= limit) break;

    const parsed = parseIngredient(row.name);
    const reason = vet(row, parsed);

    if (reason) {
      rejections.push({ row, reason });
      continue;
    }
    if (parsed.quantity === null) {
      leftAlone += 1; // genuinely unquantified: "a pinch of salt", "to taste"
      continue;
    }

    changes.push({
      row,
      newName: parsed.name.trim(),
      newQuantity: parsed.quantity,
      newUnit: parsed.unit ?? row.unit,
    });
  }

  // Separately: rows that already have a quantity but still look like they have
  // one glued into the name too. Not fixed here — a row with quantity 300 and
  // name "300 g flour" might be double-counted on screen, or might be a name
  // that legitimately starts with a number. Reported so you can look.
  const suspicious = (await sql`
    SELECT ri.id, ri.name, ri.quantity, ri.unit, r.title AS recipe_title
    FROM recipe_ingredients ri
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE ri.quantity IS NOT NULL AND ri.name ~ '^[0-9]'
    ORDER BY r.title
    LIMIT 50`) as Array<{ name: string; quantity: number; recipe_title: string }>;

  // ---- report ----

  console.log("");
  console.log(`Rows with no quantity:           ${rows.length}`);
  console.log(`  would be fixed:                ${changes.length}`);
  console.log(`  genuinely unquantified:        ${leftAlone}   (left alone by design)`);
  console.log(`  rejected by a safety rule:     ${rejections.length}`);
  console.log("");

  if (changes.length > 0) {
    const shown = verbose ? changes : changes.slice(0, 25);
    console.log(verbose ? "ALL CHANGES" : `CHANGES (first ${shown.length} of ${changes.length})`);
    let currentRecipe = "";
    for (const c of shown) {
      if (c.row.recipe_title !== currentRecipe) {
        currentRecipe = c.row.recipe_title;
        console.log(`\n  ${currentRecipe}`);
      }
      const unit = c.newUnit ? ` ${c.newUnit}` : "";
      console.log(`    ${JSON.stringify(c.row.name)}`);
      console.log(`      -> ${c.newQuantity}${unit} of ${JSON.stringify(c.newName)}`);
    }
    if (!verbose && changes.length > shown.length) {
      console.log(`\n  ...and ${changes.length - shown.length} more. Use --verbose to see them all.`);
    }
    console.log("");
  }

  if (rejections.length > 0) {
    const byReason = new Map<string, Rejection[]>();
    for (const r of rejections) {
      const key = r.reason.replace(/"[^"]*"|\d+/g, "…");
      const list = byReason.get(key) ?? [];
      list.push(r);
      byReason.set(key, list);
    }
    console.log("REJECTED — read these, they are where a parser bug would show up");
    for (const [reason, list] of byReason) {
      console.log(`\n  ${reason}  (${list.length})`);
      for (const r of list.slice(0, 5)) {
        console.log(`    ${JSON.stringify(r.row.name)}  [${r.row.recipe_title}]`);
      }
      if (list.length > 5) console.log(`    ...and ${list.length - 5} more`);
    }
    console.log("");
  }

  if (suspicious.length > 0) {
    console.log(`NOT TOUCHED — ${suspicious.length} rows already have a quantity but their name`);
    console.log("also starts with a number. Possibly double-counted on screen, possibly fine.");
    for (const s of suspicious.slice(0, 10)) {
      console.log(`    qty ${s.quantity}  name ${JSON.stringify(s.name)}  [${s.recipe_title}]`);
    }
    console.log("");
  }

  if (changes.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // ---- SQL artefacts, written in both modes ----

  const header = `-- Generated ${new Date().toISOString()} by backfill-ingredient-quantities.ts\n`;
  writeFileSync(
    "backfill-ingredients.sql",
    header + changes.map(updateStatement).join("\n") + "\n",
  );
  writeFileSync(
    "backfill-ingredients-rollback.sql",
    header +
      "-- Restores every row this backfill changed to exactly its previous values.\n" +
      changes.map(rollbackStatement).join("\n") +
      "\n",
  );
  console.log("Wrote backfill-ingredients.sql and backfill-ingredients-rollback.sql");

  if (!apply) {
    console.log("");
    console.log("Dry run — nothing was changed.");
    console.log("Read the SQL, then either paste it into the Neon editor or re-run with --apply.");
    return;
  }

  // ---- apply ----

  console.log("");
  console.log(`Applying ${changes.length} updates...`);
  let applied = 0;
  let skipped = 0;
  for (const c of changes) {
    const res = await sql`
      UPDATE recipe_ingredients
      SET name = ${c.newName}, quantity = ${c.newQuantity}, unit = ${c.newUnit}
      WHERE id = ${c.row.id} AND quantity IS NULL
      RETURNING id`;
    if ((res as unknown[]).length > 0) applied += 1;
    else skipped += 1;
  }

  console.log(`Applied ${applied}.`);
  if (skipped > 0) {
    console.log(`Skipped ${skipped} — they gained a quantity between the read and the write.`);
  }
  console.log("To undo: paste backfill-ingredients-rollback.sql into the Neon SQL editor.");
}

// Only run when executed directly, so the test file can import `vet` without
// the script trying to open a database connection.
if (process.argv[1]?.includes("backfill-ingredient-quantities")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
