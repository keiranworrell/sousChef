import type {
  ApiResponse,
  CreateRecipeInput,
  ListRecipesResponse,
  RecipeWithDetails,
  UpdateRecipeInput,
} from "../types";

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
  const get = <T>(path: string): Promise<ApiResponse<T>> =>
    request<T>(baseUrl, path, "GET", { token });
  const post = <T>(path: string, body: unknown): Promise<ApiResponse<T>> =>
    request<T>(baseUrl, path, "POST", { token, body });
  const patch = <T>(path: string, body: unknown): Promise<ApiResponse<T>> =>
    request<T>(baseUrl, path, "PATCH", { token, body });
  const del = <T>(path: string): Promise<ApiResponse<T>> =>
    request<T>(baseUrl, path, "DELETE", { token });

  return {
    get,
    post,
    patch,
    delete: del,

    recipes: {
      list: (params?: {
        limit?: number;
        offset?: number;
      }): Promise<ApiResponse<ListRecipesResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<ListRecipesResponse>(`/recipes${query}`);
      },

      get: (id: string): Promise<ApiResponse<RecipeWithDetails>> =>
        get<RecipeWithDetails>(`/recipes/${id}`),

      create: (
        input: CreateRecipeInput,
      ): Promise<ApiResponse<RecipeWithDetails>> =>
        post<RecipeWithDetails>("/recipes", input),

      update: (
        id: string,
        input: UpdateRecipeInput,
      ): Promise<ApiResponse<RecipeWithDetails>> =>
        patch<RecipeWithDetails>(`/recipes/${id}`, input),

      delete: (id: string): Promise<ApiResponse<null>> =>
        del<null>(`/recipes/${id}`),
    },
  };
}
