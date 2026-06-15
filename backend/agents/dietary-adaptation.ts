import Anthropic from "@anthropic-ai/sdk";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handleError, okResponse } from "../middleware/errors";
import { validateAuth } from "../middleware/auth";

const client = new Anthropic();

// TODO: define system prompt
const SYSTEM_PROMPT = "" as const;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    await validateAuth(event);

    // TODO: parse request body and invoke agent
    void client;
    void SYSTEM_PROMPT;

    return okResponse(null);
  } catch (err) {
    return handleError(err);
  }
};
