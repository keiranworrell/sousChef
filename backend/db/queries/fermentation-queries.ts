import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { fermentationBatches, fermentationLogs } from "../schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FermentationBatchRecord = typeof fermentationBatches.$inferSelect;
export type FermentationLogRecord = typeof fermentationLogs.$inferSelect;

export type FermentationStatus = "active" | "complete" | "abandoned";

export type CreateBatchInput = {
  userId: string;
  name: string;
  startedAt: Date;
  targetEndDate?: Date | null;
  recipeId?: string | null;
  status?: FermentationStatus;
};

export type UpdateBatchInput = Partial<Omit<CreateBatchInput, "userId">>;

export type CreateLogInput = {
  batchId: string;
  loggedAt?: Date;
  ph?: number | null;
  saltPercent?: number | null;
  temperatureCelsius?: number | null;
  weightGrams?: number | null;
  notes?: string | null;
};

export type UpdateLogInput = Partial<Omit<CreateLogInput, "batchId">>;

export type FermentationBatchWithLogs = FermentationBatchRecord & {
  logs: FermentationLogRecord[];
};

// ── Batches ───────────────────────────────────────────────────────────────────

export async function listBatches(userId: string): Promise<FermentationBatchRecord[]> {
  const db = await getDb();
  return db
    .select()
    .from(fermentationBatches)
    .where(eq(fermentationBatches.userId, userId))
    .orderBy(desc(fermentationBatches.startedAt));
}

export async function getBatchWithLogs(
  id: string,
  userId: string,
): Promise<FermentationBatchWithLogs | null> {
  const db = await getDb();
  const [batch] = await db
    .select()
    .from(fermentationBatches)
    .where(and(eq(fermentationBatches.id, id), eq(fermentationBatches.userId, userId)));
  if (!batch) return null;

  const logs = await db
    .select()
    .from(fermentationLogs)
    .where(eq(fermentationLogs.batchId, id))
    .orderBy(asc(fermentationLogs.loggedAt));

  return { ...batch, logs };
}

export async function createBatch(
  input: CreateBatchInput,
): Promise<FermentationBatchRecord> {
  const db = await getDb();
  const [batch] = await db
    .insert(fermentationBatches)
    .values({
      userId: input.userId,
      name: input.name,
      startedAt: input.startedAt,
      targetEndDate: input.targetEndDate ?? null,
      recipeId: input.recipeId ?? null,
      status: input.status ?? "active",
    })
    .returning();
  if (!batch) throw new Error("Insert returned no rows");
  return batch;
}

export async function updateBatch(
  id: string,
  userId: string,
  input: UpdateBatchInput,
): Promise<FermentationBatchRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(fermentationBatches)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
      ...(input.targetEndDate !== undefined && { targetEndDate: input.targetEndDate }),
      ...(input.recipeId !== undefined && { recipeId: input.recipeId }),
    })
    .where(and(eq(fermentationBatches.id, id), eq(fermentationBatches.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteBatch(id: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(fermentationBatches)
    .where(and(eq(fermentationBatches.id, id), eq(fermentationBatches.userId, userId)))
    .returning({ id: fermentationBatches.id });
  return result.length > 0;
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function createLog(
  input: CreateLogInput,
): Promise<FermentationLogRecord> {
  const db = await getDb();
  const [log] = await db
    .insert(fermentationLogs)
    .values({
      batchId: input.batchId,
      loggedAt: input.loggedAt ?? new Date(),
      ph: input.ph ?? null,
      saltPercent: input.saltPercent ?? null,
      temperatureCelsius: input.temperatureCelsius ?? null,
      weightGrams: input.weightGrams ?? null,
      notes: input.notes ?? null,
      imageUrl: null,
    })
    .returning();
  if (!log) throw new Error("Insert returned no rows");
  return log;
}

export async function updateLog(
  id: string,
  batchId: string,
  input: UpdateLogInput,
): Promise<FermentationLogRecord | null> {
  const db = await getDb();
  const [updated] = await db
    .update(fermentationLogs)
    .set({
      ...(input.loggedAt !== undefined && { loggedAt: input.loggedAt }),
      ...(input.ph !== undefined && { ph: input.ph }),
      ...(input.saltPercent !== undefined && { saltPercent: input.saltPercent }),
      ...(input.temperatureCelsius !== undefined && { temperatureCelsius: input.temperatureCelsius }),
      ...(input.weightGrams !== undefined && { weightGrams: input.weightGrams }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .where(and(eq(fermentationLogs.id, id), eq(fermentationLogs.batchId, batchId)))
    .returning();
  return updated ?? null;
}

export async function deleteLog(id: string, batchId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(fermentationLogs)
    .where(and(eq(fermentationLogs.id, id), eq(fermentationLogs.batchId, batchId)))
    .returning({ id: fermentationLogs.id });
  return result.length > 0;
}
