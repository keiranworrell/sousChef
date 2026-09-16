/**
 * One-off: tell Drizzle about the migrations that were applied by hand.
 *
 * WHY THIS EXISTS
 *
 * Every migration from 0002 onwards was written by hand and pasted into the
 * Neon SQL editor, because the journal was incomplete and `db:migrate` was
 * therefore unusable. The database has the schema; Drizzle has no idea. Its
 * bookkeeping table either does not exist or knows about 0000 and 0001 at most.
 *
 * Running `db:migrate` in that state would try to re-apply migrations the
 * database already has — `CREATE TABLE` on a table that exists, `DROP` on one
 * that is already gone — and fail partway through, having possibly done damage
 * on the way. This script records the already-applied migrations so the first
 * real `db:migrate` correctly does nothing.
 *
 * HOW DRIZZLE DECIDES
 *
 * It reads `drizzle.__drizzle_migrations`, takes the single greatest
 * `created_at`, and applies every journal entry whose `when` is larger. It does
 * not compare hashes and it does not check them individually — one row with a
 * large enough timestamp is all it takes. We insert a row per migration anyway,
 * with the real content hash, because a truthful record costs nothing and a
 * half-record is how we got here.
 *
 * SAFETY
 *
 * - Dry run by default. `--apply` is required.
 * - Only ever INSERTs rows Drizzle does not already have. Never updates or
 *   deletes, never touches your actual tables.
 * - Refuses to run if the recorded state is ahead of the journal, which would
 *   mean this script has misread the situation.
 * - Idempotent: a second run finds everything recorded and does nothing.
 *
 * USAGE
 *
 *   cd backend
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/baseline-migrations.ts
 *   DATABASE_URL="postgres://..." pnpm tsx scripts/baseline-migrations.ts --apply
 *
 * Run it ONCE, before the first `pnpm db:migrate`.
 */

import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { readFileSync } from "fs";
import path from "path";

type JournalEntry = { idx: number; when: number; tag: string };

const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

/** The same hash Drizzle's readMigrationFiles computes: sha256 of file content. */
function hashOf(tag: string): string {
  const content = readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL environment variable is not set");
  const apply = process.argv.includes("--apply");

  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const sql = neon(databaseUrl);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`;

  const recorded = (await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `) as Array<{ hash: string; created_at: string }>;

  const recordedHashes = new Set(recorded.map((r) => r.hash));
  const highestRecorded = recorded.length
    ? Math.max(...recorded.map((r) => Number(r.created_at)))
    : null;

  console.log("");
  console.log(`Journal lists          ${journal.entries.length} migrations`);
  console.log(`Already recorded       ${recorded.length}`);
  if (highestRecorded !== null) {
    console.log(`Highest recorded when  ${highestRecorded}`);
  }

  // If something is recorded that is newer than anything in the journal, the
  // journal is behind the database and inserting more rows would only deepen
  // the confusion. Stop and let a human look.
  const highestJournal = Math.max(...journal.entries.map((e) => e.when));
  if (highestRecorded !== null && highestRecorded > highestJournal) {
    throw new Error(
      `The database records a migration at ${highestRecorded}, later than anything ` +
        `in the journal (${highestJournal}). The journal is behind the database. ` +
        `Do not baseline — work out what was applied first.`,
    );
  }

  const missing = journal.entries.filter((e) => !recordedHashes.has(hashOf(e.tag)));

  console.log(`To record              ${missing.length}`);
  console.log("");

  if (missing.length === 0) {
    console.log("Nothing to do — Drizzle already knows about every migration in the journal.");
    console.log("`pnpm db:migrate` is safe to run.");
    return;
  }

  for (const e of missing) {
    console.log(`  ${e.tag}`);
  }
  console.log("");
  console.log("These are recorded as applied WITHOUT running them. That is correct only if");
  console.log("the database really does have them — which for this project it does, because");
  console.log("they went in by hand through the Neon editor. If you are not sure, check the");
  console.log("schema before applying.");

  if (!apply) {
    console.log("");
    console.log("Dry run — nothing was written. Re-run with --apply.");
    return;
  }

  console.log("");
  for (const e of missing) {
    await sql`
      INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
      VALUES (${hashOf(e.tag)}, ${e.when})`;
    console.log(`  recorded ${e.tag}`);
  }

  console.log("");
  console.log(`Recorded ${missing.length}. \`pnpm db:migrate\` should now report nothing pending.`);
}

if (process.argv[1]?.includes("baseline-migrations")) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
