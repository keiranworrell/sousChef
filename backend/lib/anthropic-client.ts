import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import Anthropic from "@anthropic-ai/sdk";

const sm = new SecretsManagerClient({ region: process.env["AWS_REGION"] ?? "eu-west-2" });

let _client: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client.
 * The API key is retrieved from AWS Secrets Manager on the first call
 * and cached for the lifetime of the Lambda container.
 */
export async function getAnthropicClient(): Promise<Anthropic> {
  if (_client) return _client;

  const secretArn = process.env["ANTHROPIC_SECRET_ARN"];
  if (!secretArn) {
    throw new Error("ANTHROPIC_SECRET_ARN environment variable is not set");
  }

  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const apiKey = res.SecretString;
  if (!apiKey) {
    throw new Error("Secret value for ANTHROPIC_SECRET_ARN is empty");
  }

  _client = new Anthropic({ apiKey: apiKey.trim() });
  return _client;
}
