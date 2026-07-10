import type {
  ApiResponse,
  UpdateUserInput,
  User,
  UserProfile,
  UserFollowListResponse,
  FeedResponse,
  CookHistoryEntry,
  CookHistoryResponse,
  RediscoverMode,
  RediscoverResponse,
  CommunityFeedParams,
  CommunityFeedResponse,
  CommunityRecipe,
  CreateFermentationBatchInput,
  CreateFermentationLogInput,
  CreateMealPlanEntryInput,
  CreatePantryItemInput,
  CreateRecipeInput,
  CreateShoppingListInput,
  CreateShoppingListItemInput,
  FermentationBatch,
  FermentationBatchWithLogs,
  FermentationLog,
  ImportRecipeInput,
  ListFermentationBatchesResponse,
  ListPantryItemsResponse,
  ListRecipesResponse,
  ListShoppingListsResponse,
  MealPlanEntry,
  MealPlanWithEntries,
  PantryItem,
  RecipeWithDetails,
  ShoppingList,
  ShoppingListItem,
  ShoppingListWithItems,
  UpdateFermentationBatchInput,
  UpdateFermentationLogInput,
  UpdatePantryItemInput,
  UpdateRecipeInput,
  UpdateShoppingListInput,
  UpdateShoppingListItemInput,
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
        tag?: string;
        difficulty?: string;
        sort?: "newest" | "oldest" | "title";
      }): Promise<ApiResponse<ListRecipesResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        if (params?.tag) qs.set("tag", params.tag);
        if (params?.difficulty) qs.set("difficulty", params.difficulty);
        if (params?.sort) qs.set("sort", params.sort);
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<ListRecipesResponse>(`/recipes${query}`);
      },

      get: (id: string): Promise<ApiResponse<RecipeWithDetails>> =>
        get<RecipeWithDetails>(`/recipes/${id}`),

      create: (input: CreateRecipeInput): Promise<ApiResponse<RecipeWithDetails>> =>
        post<RecipeWithDetails>("/recipes", input),

      update: (id: string, input: UpdateRecipeInput): Promise<ApiResponse<RecipeWithDetails>> =>

        patch<RecipeWithDetails>(`/recipes/${id}`, input),

      delete: (id: string): Promise<ApiResponse<null>> =>
        del<null>(`/recipes/${id}`),

      parse: (input: ImportRecipeInput): Promise<ApiResponse<CreateRecipeInput>> =>
        post<CreateRecipeInput>("/recipes/import/parse", input),

      import: (input: ImportRecipeInput): Promise<ApiResponse<RecipeWithDetails>> =>
        post<RecipeWithDetails>("/recipes/import", input),

      logCook: (recipeId: string): Promise<ApiResponse<CookHistoryEntry>> =>
        post<CookHistoryEntry>(`/recipes/${recipeId}/cook`, {}),

      rediscover: (mode: RediscoverMode): Promise<ApiResponse<RediscoverResponse>> =>
        get<RediscoverResponse>(`/recipes/rediscover?mode=${encodeURIComponent(mode)}`),
    },

    feed: {
      list: (params?: { limit?: number; offset?: number }): Promise<ApiResponse<FeedResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<FeedResponse>(`/feed${query}`);
      },
    },

    cookHistory: {
      list: (params?: { limit?: number; offset?: number }): Promise<ApiResponse<CookHistoryResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<CookHistoryResponse>(`/recipes/cook-history${query}`);
      },
    },

    pantry: {
      list: (): Promise<ApiResponse<ListPantryItemsResponse>> =>
        get<ListPantryItemsResponse>("/pantry"),

      create: (input: CreatePantryItemInput): Promise<ApiResponse<PantryItem>> =>
        post<PantryItem>("/pantry", input),

      update: (id: string, input: UpdatePantryItemInput): Promise<ApiResponse<PantryItem>> =>
        patch<PantryItem>(`/pantry/${id}`, input),

      delete: (id: string): Promise<ApiResponse<null>> =>
        del<null>(`/pantry/${id}`),
    },

    users: {
      me: (): Promise<ApiResponse<User>> =>
        get<User>("/users/me"),

      update: (input: UpdateUserInput): Promise<ApiResponse<User>> =>
        patch<User>("/users/me", input),

      profile: (userId: string): Promise<ApiResponse<UserProfile>> =>
        get<UserProfile>(`/users/${userId}`),

      follow: (userId: string): Promise<ApiResponse<null>> =>
        post<null>(`/users/${userId}/follow`, {}),

      unfollow: (userId: string): Promise<ApiResponse<null>> =>
        del<null>(`/users/${userId}/follow`),

      followers: (
        userId: string,
        params?: { limit?: number; offset?: number },
      ): Promise<ApiResponse<UserFollowListResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<UserFollowListResponse>(`/users/${userId}/followers${query}`);
      },

      following: (
        userId: string,
        params?: { limit?: number; offset?: number },
      ): Promise<ApiResponse<UserFollowListResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<UserFollowListResponse>(`/users/${userId}/following${query}`);
      },
    },

    images: {
      presign: (contentType: string, context: "recipe" | "avatar" = "recipe"): Promise<ApiResponse<{ uploadUrl: string; imageUrl: string }>> =>
        post<{ uploadUrl: string; imageUrl: string }>("/images/presign", { contentType, context }),
    },

    public: {
      getRecipe: (recipeId: string): Promise<ApiResponse<CommunityRecipe>> =>
        get<CommunityRecipe>(`/public/recipes/${recipeId}`),
    },

    community: {
      list: (params?: CommunityFeedParams): Promise<ApiResponse<CommunityFeedResponse>> => {
        const qs = new URLSearchParams();
        if (params?.q) qs.set("q", params.q);
        if (params?.cuisine) qs.set("cuisine", params.cuisine);
        if (params?.tag) qs.set("tag", params.tag);
        if (params?.creator) qs.set("creator", params.creator);
        if (params?.creatorId) qs.set("creatorId", params.creatorId);
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<CommunityFeedResponse>(`/community/recipes${query}`);
      },

      get: (recipeId: string): Promise<ApiResponse<CommunityRecipe>> =>
        get<CommunityRecipe>(`/community/recipes/${recipeId}`),

      fork: (recipeId: string): Promise<ApiResponse<RecipeWithDetails>> =>
        post<RecipeWithDetails>(`/community/recipes/${recipeId}/fork`, {}),
    },

    fermentation: {
      list: (): Promise<ApiResponse<ListFermentationBatchesResponse>> =>
        get<ListFermentationBatchesResponse>("/fermentation"),

      get: (batchId: string): Promise<ApiResponse<FermentationBatchWithLogs>> =>
        get<FermentationBatchWithLogs>(`/fermentation/${batchId}`),

      create: (input: CreateFermentationBatchInput): Promise<ApiResponse<FermentationBatch>> =>
        post<FermentationBatch>("/fermentation", input),

      update: (batchId: string, input: UpdateFermentationBatchInput): Promise<ApiResponse<FermentationBatch>> =>
        patch<FermentationBatch>(`/fermentation/${batchId}`, input),

      delete: (batchId: string): Promise<ApiResponse<null>> =>
        del<null>(`/fermentation/${batchId}`),

      logs: {
        create: (batchId: string, input: CreateFermentationLogInput): Promise<ApiResponse<FermentationLog>> =>
          post<FermentationLog>(`/fermentation/${batchId}/logs`, input),

        update: (batchId: string, logId: string, input: UpdateFermentationLogInput): Promise<ApiResponse<FermentationLog>> =>
          patch<FermentationLog>(`/fermentation/${batchId}/logs/${logId}`, input),

        delete: (batchId: string, logId: string): Promise<ApiResponse<null>> =>
          del<null>(`/fermentation/${batchId}/logs/${logId}`),
      },
    },

    mealPlans: {
      get: (weekStart?: string): Promise<ApiResponse<MealPlanWithEntries>> => {
        const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
        return get<MealPlanWithEntries>(`/meal-plans${qs}`);
      },

      addEntry: (planId: string, input: CreateMealPlanEntryInput): Promise<ApiResponse<MealPlanEntry>> =>
        post<MealPlanEntry>(`/meal-plans/${planId}/entries`, input),

      removeEntry: (planId: string, entryId: string): Promise<ApiResponse<null>> =>
        del<null>(`/meal-plans/${planId}/entries/${entryId}`),

      generateShoppingList: (
        planId: string,
        input: { name?: string; deductPantry?: boolean },
      ): Promise<ApiResponse<ShoppingListWithItems>> =>
        post<ShoppingListWithItems>(`/meal-plans/${planId}/shopping-list`, input),
    },

    shopping: {
      list: (): Promise<ApiResponse<ListShoppingListsResponse>> =>
        get<ListShoppingListsResponse>("/shopping"),

      get: (listId: string): Promise<ApiResponse<ShoppingListWithItems>> =>
        get<ShoppingListWithItems>(`/shopping/${listId}`),

      create: (input: CreateShoppingListInput): Promise<ApiResponse<ShoppingList>> =>
        post<ShoppingList>("/shopping", input),

      update: (listId: string, input: UpdateShoppingListInput): Promise<ApiResponse<ShoppingList>> =>
        patch<ShoppingList>(`/shopping/${listId}`, input),

      delete: (listId: string): Promise<ApiResponse<null>> =>
        del<null>(`/shopping/${listId}`),

      complete: (listId: string): Promise<ApiResponse<{ pantryItemsAffected: number }>> =>
        post<{ pantryItemsAffected: number }>(`/shopping/${listId}/complete`, {}),

      items: {
        create: (listId: string, input: CreateShoppingListItemInput): Promise<ApiResponse<ShoppingListItem>> =>
          post<ShoppingListItem>(`/shopping/${listId}/items`, input),

        bulkAdd: (
          listId: string,
          items: Array<{ name: string; quantity?: number | null; unit?: string | null }>,
        ): Promise<ApiResponse<ShoppingListItem[]>> =>
          post<ShoppingListItem[]>(`/shopping/${listId}/items/bulk`, { items }),

        update: (listId: string, itemId: string, input: UpdateShoppingListItemInput): Promise<ApiResponse<ShoppingListItem>> =>
          patch<ShoppingListItem>(`/shopping/${listId}/items/${itemId}`, input),

        delete: (listId: string, itemId: string): Promise<ApiResponse<null>> =>
          del<null>(`/shopping/${listId}/items/${itemId}`),
      },
    },
  };
}
