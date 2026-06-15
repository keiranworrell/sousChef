import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Returns a singleton Drizzle client connected to Neon.
 * DATABASE_URL is retrieved from AWS Secrets Manager at cold start
 * and injected into the environment before this module is loaded.
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (_db) return _db;

  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(databaseUrl);
  _db = drizzle(sql, { schema });
  return _db;
}
