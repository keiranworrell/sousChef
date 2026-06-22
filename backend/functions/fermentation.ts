import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  listBatches,
  getBatchWithLogs,
  createBatch,
  updateBatch,
  deleteBatch,
  createLog,
  updateLog,
  deleteLog,
} from "../db/queries/fermentation-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateBatchSchema = z.object({
  name: z.string().min(1).max(255),
  startedAt: z.string().datetime(),
  targetEndDate: z.string().datetime().nullable().optional(),
  recipeId: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "complete", "abandoned"]).optional(),
});

const UpdateBatchSchema = CreateBatchSchema.partial();

const CreateLogSchema = z.object({
  loggedAt: z.string().datetime().optional(),
  ph: z.number().min(0).max(14).nullable().optional(),
  saltPercent: z.number().min(0).max(100).nullable().optional(),
  temperatureCelsius: z.number().min(-20).max(100).nullable().optional(),
  weightGrams: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const UpdateLogSchema = CreateLogSchema.partial();

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandlerV2 = async (
  event,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await validateAuth(event);
    const user = await getUserByCognitoId(auth.cognitoId);
    if (!user) throw new NotFoundError("User not found");

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";

    // ── Log routes: /fermentation/{batchId}/logs[/{logId}] ──────────────────

    const logMatch = path.match(/\/fermentation\/([^/]+)\/logs(?:\/([^/]+))?$/);
    if (logMatch) {
      const batchId = logMatch[1]!;
      const logId = logMatch[2];

      // Verify batch ownership
      const batch = await getBatchWithLogs(batchId, user.id);
      if (!batch) throw new NotFoundError("Batch not found");

      // POST /fermentation/{batchId}/logs
      if (method === "POST" && !logId) {
        const body = parseBody(event.body, CreateLogSchema);
        const log = await createLog({
          ...body,
          batchId,
          loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
        });
        return okResponse(log, 201);
      }

      // PATCH /fermentation/{batchId}/logs/{logId}
      if (method === "PATCH" && logId) {
        const body = parseBody(event.body, UpdateLogSchema);
        const log = await updateLog(logId, batchId, {
          ...body,
          loggedAt: body.loggedAt ? new Date(body.loggedAt) : undefined,
        });
        if (!log) throw new NotFoundError("Log entry not found");
        return okResponse(log);
      }

      // DELETE /fermentation/{batchId}/logs/{logId}
      if (method === "DELETE" && logId) {
        const deleted = await deleteLog(logId, batchId);
        if (!deleted) throw new NotFoundError("Log entry not found");
        return okResponse(null, 204);
      }
    }

    // ── Batch routes: /fermentation[/{batchId}] ──────────────────────────────

    const batchId = event.pathParameters?.["batchId"];

    // GET /fermentation
    if (method === "GET" && !batchId) {
      const batches = await listBatches(user.id);
      return okResponse({ batches });
    }

    // POST /fermentation
    if (method === "POST" && !batchId) {
      const body = parseBody(event.body, CreateBatchSchema);
      const batch = await createBatch({
        ...body,
        userId: user.id,
        startedAt: new Date(body.startedAt),
        targetEndDate: body.targetEndDate ? new Date(body.targetEndDate) : null,
      });
      return okResponse(batch, 201);
    }

    // GET /fermentation/{batchId}
    if (method === "GET" && batchId) {
      const batch = await getBatchWithLogs(batchId, user.id);
      if (!batch) throw new NotFoundError("Batch not found");
      return okResponse(batch);
    }

    // PATCH /fermentation/{batchId}
    if (method === "PATCH" && batchId) {
      const body = parseBody(event.body, UpdateBatchSchema);
      const batch = await updateBatch(batchId, user.id, {
        ...body,
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
        targetEndDate: body.targetEndDate !== undefined
          ? (body.targetEndDate ? new Date(body.targetEndDate) : null)
          : undefined,
      });
      if (!batch) throw new NotFoundError("Batch not found");
      return okResponse(batch);
    }

    // DELETE /fermentation/{batchId}
    if (method === "DELETE" && batchId) {
      const deleted = await deleteBatch(batchId, user.id);
      if (!deleted) throw new NotFoundError("Batch not found");
      return okResponse(null, 204);
    }

    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
      }),
    };
  } catch (err) {
    return handleError(err);
  }
};
