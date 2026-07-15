import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { validateAuth } from "../middleware/auth";
import { handleError, okResponse, NotFoundError, ConflictError, BadRequestError } from "../middleware/errors";
import { parseBody } from "../middleware/validation";
import { getUserByCognitoId } from "../db/queries/user-queries";
import {
  getUserHousehold,
  createHousehold,
  inviteToHousehold,
  acceptHouseholdInvite,
  declineHouseholdInvite,
  leaveHousehold,
  renameHousehold,
  deleteHousehold,
} from "../db/queries/household-queries";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateHouseholdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const RenameHouseholdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const InviteSchema = z.object({
  inviteeId: z.string().uuid(),
});

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

    // POST /households/invites/{inviteId}/accept
    const acceptMatch = path.match(/\/households\/invites\/([^/]+)\/accept$/);
    if (acceptMatch && method === "POST") {
      const inviteId = acceptMatch[1]!;
      try {
        const household = await acceptHouseholdInvite(inviteId, user.id);
        return okResponse(household);
      } catch (err) {
        if (err instanceof Error && err.message === "INVITE_NOT_FOUND") {
          throw new NotFoundError("Invite not found or already actioned");
        }
        throw err;
      }
    }

    // POST /households/invites/{inviteId}/decline
    const declineMatch = path.match(/\/households\/invites\/([^/]+)\/decline$/);
    if (declineMatch && method === "POST") {
      const inviteId = declineMatch[1]!;
      try {
        await declineHouseholdInvite(inviteId, user.id);
        return okResponse(null, 204);
      } catch (err) {
        if (err instanceof Error && err.message === "INVITE_NOT_FOUND") {
          throw new NotFoundError("Invite not found or already actioned");
        }
        throw err;
      }
    }

    // POST /households/invites
    if (method === "POST" && path.endsWith("/households/invites")) {
      const body = parseBody(event.body, InviteSchema);
      try {
        const invite = await inviteToHousehold(user.id, body.inviteeId);
        return okResponse(invite, 201);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === "INVITER_NOT_IN_HOUSEHOLD") {
            throw new BadRequestError("You must be in a household to send invites");
          }
          if (err.message === "INVITEE_ALREADY_IN_HOUSEHOLD") {
            throw new ConflictError("That user is already in a household");
          }
        }
        throw err;
      }
    }

    // POST /households/me/leave
    if (method === "POST" && path.endsWith("/households/me/leave")) {
      await leaveHousehold(user.id);
      return okResponse(null, 204);
    }

    // PATCH /households/me  — rename (owner only)
    if (method === "PATCH" && path.endsWith("/households/me")) {
      const body = parseBody(event.body, RenameHouseholdSchema);
      try {
        const household = await renameHousehold(user.id, body.name);
        return okResponse(household);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === "NOT_IN_HOUSEHOLD") throw new BadRequestError("You are not in a household");
          if (err.message === "NOT_OWNER") throw new BadRequestError("Only the household owner can rename it");
        }
        throw err;
      }
    }

    // DELETE /households/me  — delete household (owner only)
    if (method === "DELETE" && path.endsWith("/households/me")) {
      try {
        await deleteHousehold(user.id);
        return okResponse(null, 204);
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === "NOT_IN_HOUSEHOLD") throw new BadRequestError("You are not in a household");
          if (err.message === "NOT_OWNER") throw new BadRequestError("Only the household owner can delete it");
        }
        throw err;
      }
    }

    // GET /households/me
    if (method === "GET" && path.endsWith("/households/me")) {
      const household = await getUserHousehold(user.id);
      return okResponse(household); // null if not in a household
    }

    // POST /households
    if (method === "POST" && path.endsWith("/households")) {
      const body = parseBody(event.body, CreateHouseholdSchema);
      try {
        const household = await createHousehold(user.id, body.name);
        return okResponse(household, 201);
      } catch (err) {
        if (err instanceof Error && err.message === "USER_ALREADY_IN_HOUSEHOLD") {
          throw new ConflictError("You are already in a household");
        }
        throw err;
      }
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
