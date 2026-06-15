import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// TODO: implement mealplans handlers

export const handler: APIGatewayProxyHandlerV2 = async (_event) => {
  return {
    statusCode: 501,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: { code: "NOT_IMPLEMENTED", message: "Not yet implemented" },
    }),
  };
};
