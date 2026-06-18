import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import path from "path";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Running migrations...");
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "../../migrations"),
  });
  console.log("Migrations complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
