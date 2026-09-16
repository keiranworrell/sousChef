import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";

/**
 * Guards the migration journal against the two ways it can lie.
 *
 * Drizzle's migrator does not read the migrations directory. It reads
 * `meta/_journal.json` and loads only the files listed there — so a .sql file
 * that never made it into the journal is not "pending", it is *invisible*, and
 * `db:migrate` will report success having skipped it entirely. That is exactly
 * how `0016_collection_shares.sql` reached production unapplied and cost a day
 * diagnosing two 500s.
 *
 * It also does not compare hashes. It takes the single greatest `created_at`
 * in `__drizzle_migrations` and applies every migration whose journal `when` is
 * larger. So the `when` values have to be strictly increasing, or a migration
 * sitting behind a larger timestamp is skipped silently and permanently. The
 * journal shipped with entry 0000 dated a year *after* 0001, which meant 0001
 * could never have been applied by the migrator on a fresh database.
 *
 * Both failures are silent by construction. Hence a test.
 */

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
type Journal = { version: string; dialect: string; entries: JournalEntry[] };

const migrationsDir = path.join(__dirname, "../../migrations");

function readJournal(): Journal {
  return JSON.parse(readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8")) as Journal;
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

describe("migration journal", () => {
  it("lists every migration file that exists on disk", () => {
    const journalTags = new Set(readJournal().entries.map((e) => e.tag));
    const missing = migrationFiles().filter((f) => !journalTags.has(f));

    // If this fails you have added a .sql file without a journal entry. The
    // migrator will not see it. Add it to meta/_journal.json with a `when`
    // greater than the entry before it.
    expect(missing, "migration files absent from the journal").toEqual([]);
  });

  it("has a file on disk for every entry it lists", () => {
    const files = new Set(migrationFiles());
    const orphaned = readJournal().entries.map((e) => e.tag).filter((t) => !files.has(t));

    // The migrator throws on a missing file, so this one at least fails loudly
    // in production. Catching it here is just cheaper.
    expect(orphaned, "journal entries with no .sql file").toEqual([]);
  });

  it("orders entries by a strictly increasing timestamp", () => {
    const entries = readJournal().entries;
    const offenders: string[] = [];

    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1]!;
      const curr = entries[i]!;
      if (curr.when <= prev.when) {
        offenders.push(`${curr.tag} (${curr.when}) does not come after ${prev.tag} (${prev.when})`);
      }
    }

    // A migration whose `when` is not greater than the one before it can never
    // be applied by the migrator, because the comparison is against the largest
    // timestamp already recorded — not against this migration's own record.
    expect(offenders, "migrations that the migrator would silently skip").toEqual([]);
  });

  it("numbers entries sequentially from zero, matching the filename prefix", () => {
    const entries = readJournal().entries;
    const mismatched = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e, i }) => e.idx !== i || !e.tag.startsWith(String(i).padStart(4, "0")))
      .map(({ e, i }) => `position ${i}: idx ${e.idx}, tag ${e.tag}`);

    expect(mismatched, "journal entries whose idx or filename prefix is out of step").toEqual([]);
  });

  it("does not list the same tag twice", () => {
    const tags = readJournal().entries.map((e) => e.tag);
    expect(tags.length, "duplicate tags in the journal").toBe(new Set(tags).size);
  });
});
