import type { ApiResponse } from "../types";

type RequestOptions = {
  token?: string;
  body?: unknown;
};

async function request<T>(
  baseUrl: string,
  path: string,
  method: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return response.json() as Promise<ApiResponse<T>>;
}

export function createApiClient(baseUrl: string, token?: string) {
  return {
    get: <T>(path: string): Promise<ApiResponse<T>> =>
      request<T>(baseUrl, path, "GET", { token }),
    post: <T>(path: string, body: unknown): Promise<ApiResponse<T>> =>
      request<T>(baseUrl, path, "POST", { token, body }),
    put: <T>(path: string, body: unknown): Promise<ApiResponse<T>> =>
      request<T>(baseUrl, path, "PUT", { token, body }),
    patch: <T>(path: string, body: unknown): Promise<ApiResponse<T>> =>
      request<T>(baseUrl, path, "PATCH", { token, body }),
    delete: <T>(path: string): Promise<ApiResponse<T>> =>
      request<T>(baseUrl, path, "DELETE", { token }),
  };
}
