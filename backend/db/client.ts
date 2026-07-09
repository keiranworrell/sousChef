import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sm = new SecretsManagerClient({ region: process.env["AWS_REGION"] ?? "eu-west-2" });

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Returns a singleton Drizzle client connected to Neon.
 * The database URL is retrieved from AWS Secrets Manager on the first call
 * and cached for the lifetime of the Lambda container.
 */
export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  if (_db) return _db;

  const secretArn = process.env["DATABASE_SECRET_ARN"];
  if (!secretArn) {
    throw new Error("DATABASE_SECRET_ARN environment variable is not set");
  }

  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const databaseUrl = res.SecretString;
  if (!databaseUrl) {
    throw new Error("Secret value for DATABASE_SECRET_ARN is empty");
  }

  const sql = neon(databaseUrl);
  _db = drizzle(sql, { schema });
  return _db;
}
