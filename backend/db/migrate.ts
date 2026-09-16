import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { readdirSync, readFileSync } from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(__dirname, "../../migrations");

type JournalEntry = { idx: number; when: number; tag: string };

/**
 * Refuses to migrate against a journal that disagrees with the directory.
 *
 * Drizzle's migrator reads the journal, not the directory. A .sql file with no
 * journal entry is not pending — it is invisible, and `migrate()` will report
 * success having never seen it. `0016_collection_shares.sql` reached production
 * that way and broke two endpoints until someone thought to check whether the
 * table existed at all.
 *
 * The same applies to the ordering. The migrator compares each entry's `when`
 * against the single greatest `created_at` already recorded, so an entry whose
 * timestamp is not greater than its predecessor's can never be reached.
 *
 * There is a test covering both of these (`migrations-journal.test.ts`), so in
 * principle a broken journal never reaches `main`. This check exists because
 * the cost of being wrong is a database that silently disagrees with the
 * schema, and the cost of the check is a directory listing.
 */
function verifyJournal(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const onDisk = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""));

  const listed = new Set(journal.entries.map((e) => e.tag));
  const missing = onDisk.filter((f) => !listed.has(f)).sort();
  if (missing.length > 0) {
    throw new Error(
      `These migration files are not in meta/_journal.json and would be SKIPPED:\n` +
        missing.map((m) => `  ${m}`).join("\n") +
        `\n\nAdd each to the journal with a \`when\` greater than the entry before it.`,
    );
  }

  for (let i = 1; i < journal.entries.length; i += 1) {
    const prev = journal.entries[i - 1]!;
    const curr = journal.entries[i]!;
    if (curr.when <= prev.when) {
      throw new Error(
        `Journal entry ${curr.tag} (when ${curr.when}) is not later than ` +
          `${prev.tag} (when ${prev.when}). The migrator would skip it permanently.`,
      );
    }
  }

  return journal.entries;
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const entries = verifyJournal();

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  // Report what is actually pending before doing it, so a run that is about to
  // apply nine migrations does not look identical to one applying none.
  const recorded = (await sql`
    SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1
  `.catch(() => [])) as Array<{ created_at: string }>;

  const high = recorded[0] ? Number(recorded[0].created_at) : null;
  const pending = entries.filter((e) => high === null || e.when > high);

  if (pending.length === 0) {
    console.log(`Up to date — all ${entries.length} migrations already applied.`);
    return;
  }

  if (high === null && entries.length > 1) {
    console.log(
      "No migration history recorded. If this database was built by applying SQL\n" +
        "by hand, stop and run scripts/baseline-migrations.ts first — otherwise the\n" +
        "migrations below will be re-applied against a schema that already has them.\n",
    );
  }

  console.log(`Applying ${pending.length} migration(s):`);
  for (const p of pending) console.log(`  ${p.tag}`);

  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  console.log("Migrations complete.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
