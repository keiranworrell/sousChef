import type {
  ApiResponse,
  UpdateUserInput,
  User,
  UserDataExport,
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
  Collection,
  CollectionWithItems,
  PublicCollectionWithItems,
  CreateCollectionInput,
  UpdateCollectionInput,
  ListCollectionsResponse,
  ListPublicCollectionsResponse,
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
  ImportRecipeTextInput,
  ImportRecipePhotoInput,
  ListFermentationBatchesResponse,
  ListPantryItemsResponse,
  PantrySuggestionsResponse,
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
  Household,
  HouseholdInvite,
  NotificationListResponse,
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

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // fetch rejects on network failure, DNS failure and CORS rejection. Letting
    // that raw TypeError escape means callers see an error shaped differently
    // from every other failure, so normalise it into the envelope.
    return {
      error: {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error && err.message
            ? err.message
            : "Could not reach the server. Check your connection and try again.",
      },
    } as ApiResponse<T>;
  }

  // Browsers treat 204 (and other null-body statuses) as having no body, so
  // response.json() would throw a parse error. Read as text first.
  const text = await response.text();

  if (!text) {
    // An empty body only means success on a 2xx. Previously this returned
    // `{ data: null }` regardless of status, so a 429 from the rate limiter or a
    // 502 from API Gateway — both of which can have empty bodies — were
    // indistinguishable from a successful 204 and read as success at every call
    // site.
    if (response.ok) return { data: null } as ApiResponse<T>;
    return {
      error: {
        code: httpErrorCode(response.status),
        message: httpErrorMessage(response.status),
      },
    } as ApiResponse<T>;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Non-JSON body — an API Gateway or proxy HTML error page, most often.
    // JSON.parse would otherwise throw a SyntaxError that says nothing useful.
    return {
      error: {
        code: response.ok ? "INVALID_RESPONSE" : httpErrorCode(response.status),
        message: response.ok
          ? "The server returned an unreadable response."
          : httpErrorMessage(response.status),
      },
    } as ApiResponse<T>;
  }

  // A non-2xx that did return JSON should carry our own error envelope. If it
  // doesn't, the body came from somewhere other than our handlers, so build one
  // rather than passing a foreign shape back as though it were data.
  if (!response.ok && !(typeof parsed === "object" && parsed !== null && "error" in parsed)) {
    return {
      error: {
        code: httpErrorCode(response.status),
        message: httpErrorMessage(response.status),
      },
    } as ApiResponse<T>;
  }

  return parsed as ApiResponse<T>;
}

function httpErrorCode(status: number): string {
  if (status === 401) return "UNAUTHORISED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

function httpErrorMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item could not be found.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return `Request failed (HTTP ${status})`;
}

/**
 * Returns the payload, or throws if the response is an error envelope.
 *
 * The client returns `{ data } | { error }` rather than throwing, which is fine
 * when the caller checks — and silently wrong when it doesn't. `await api.x.y()`
 * with the result discarded looks like it succeeded no matter what came back,
 * and every surrounding try/catch is dead code. That is what hid the collection
 * picker bug (PR #126): a failed write still flipped the checkbox.
 *
 * Use this wherever the result isn't otherwise inspected. It turns a silent
 * failure into a thrown one that existing error handling can act on.
 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if ("error" in response) {
    const err = new Error(response.error.message) as Error & { code?: string };
    err.code = response.error.code;
    throw err;
  }
  return response.data;
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
        cursor?: string;
        q?: string;
        tag?: string;
        difficulty?: string;
        sort?: "newest" | "oldest" | "title";
      }): Promise<ApiResponse<ListRecipesResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.cursor) qs.set("cursor", params.cursor);
        if (params?.q) qs.set("q", params.q);
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

      importAi: (input: ImportRecipeInput): Promise<ApiResponse<CreateRecipeInput>> =>
        post<CreateRecipeInput>("/recipes/import/ai", input),

      importText: (input: ImportRecipeTextInput): Promise<ApiResponse<CreateRecipeInput>> =>
        post<CreateRecipeInput>("/recipes/import/text", input),

      importPhoto: (input: ImportRecipePhotoInput): Promise<ApiResponse<CreateRecipeInput>> =>
        post<CreateRecipeInput>("/recipes/import/photo", input),

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

      suggestions: (): Promise<ApiResponse<PantrySuggestionsResponse>> =>
        get<PantrySuggestionsResponse>("/pantry/suggestions"),

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

      deleteAccount: (): Promise<ApiResponse<null>> =>
        del<null>("/users/me"),

      /**
       * Full export of the caller's data, for UK GDPR access/portability.
       * Returned as a parsed object rather than a file so the caller controls
       * how it's delivered — the web app turns it into a download.
       */
      exportData: (): Promise<ApiResponse<UserDataExport>> =>
        get<UserDataExport>("/users/me/export"),

      profile: (userId: string): Promise<ApiResponse<UserProfile>> =>
        get<UserProfile>(`/users/${userId}`),

      follow: (userId: string): Promise<ApiResponse<null>> =>
        post<null>(`/users/${userId}/follow`, {}),

      unfollow: (userId: string): Promise<ApiResponse<null>> =>
        del<null>(`/users/${userId}/follow`),

      search: (params?: { q?: string; limit?: number; offset?: number }): Promise<ApiResponse<UserFollowListResponse>> => {
        const qs = new URLSearchParams();
        if (params?.q) qs.set("q", params.q);
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<UserFollowListResponse>(`/users${query}`);
      },

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
        if (params?.sort) qs.set("sort", params.sort);
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.cursor) qs.set("cursor", params.cursor);
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<CommunityFeedResponse>(`/community/recipes${query}`);
      },

      get: (recipeId: string): Promise<ApiResponse<CommunityRecipe>> =>
        get<CommunityRecipe>(`/community/recipes/${recipeId}`),

      fork: (recipeId: string): Promise<ApiResponse<RecipeWithDetails>> =>
        post<RecipeWithDetails>(`/community/recipes/${recipeId}/fork`, {}),

      like: (recipeId: string): Promise<ApiResponse<null>> =>
        post<null>(`/community/recipes/${recipeId}/like`, {}),

      unlike: (recipeId: string): Promise<ApiResponse<null>> =>
        del<null>(`/community/recipes/${recipeId}/like`),
    },

    collections: {
      list: (): Promise<ApiResponse<ListCollectionsResponse>> =>
        get<ListCollectionsResponse>("/collections"),

      get: (id: string): Promise<ApiResponse<CollectionWithItems>> =>
        get<CollectionWithItems>(`/collections/${id}`),

      create: (input: CreateCollectionInput): Promise<ApiResponse<Collection>> =>
        post<Collection>("/collections", input),

      update: (id: string, input: UpdateCollectionInput): Promise<ApiResponse<Collection>> =>
        patch<Collection>(`/collections/${id}`, input),

      delete: (id: string): Promise<ApiResponse<null>> =>
        del<null>(`/collections/${id}`),

      addRecipe: (collectionId: string, recipeId: string): Promise<ApiResponse<null>> =>
        post<null>(`/collections/${collectionId}/recipes/${recipeId}`, {}),

      removeRecipe: (collectionId: string, recipeId: string): Promise<ApiResponse<null>> =>
        del<null>(`/collections/${collectionId}/recipes/${recipeId}`),

      /**
       * Applies a batch of membership changes in one request. Send only what
       * changed — a full membership set would overwrite concurrent edits made
       * on another device.
       */
      updateRecipes: (
        collectionId: string,
        changes: { add: string[]; remove: string[] },
      ): Promise<ApiResponse<{ added: number; removed: number }>> =>
        patch<{ added: number; removed: number }>(
          `/collections/${collectionId}/recipes`,
          changes,
        ),

      forRecipe: (recipeId: string): Promise<ApiResponse<{ collectionIds: string[] }>> =>
        get<{ collectionIds: string[] }>(`/collections/for-recipe/${recipeId}`),

      listPublic: (params?: { limit?: number; offset?: number }): Promise<ApiResponse<ListPublicCollectionsResponse>> => {
        const qs = new URLSearchParams();
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        return get<ListPublicCollectionsResponse>(`/collections/public${query}`);
      },

      getPublic: (id: string): Promise<ApiResponse<PublicCollectionWithItems>> =>
        get<PublicCollectionWithItems>(`/collections/public/${id}`),
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

    households: {
      get: (): Promise<ApiResponse<Household | null>> =>
        get<Household | null>("/households/me"),

      create: (name: string): Promise<ApiResponse<Household>> =>
        post<Household>("/households", { name }),

      rename: (name: string): Promise<ApiResponse<Household>> =>
        patch<Household>("/households/me", { name }),

      delete: (): Promise<ApiResponse<null>> =>
        del<null>("/households/me"),

      invite: (inviteeId: string): Promise<ApiResponse<HouseholdInvite>> =>
        post<HouseholdInvite>("/households/invites", { inviteeId }),

      acceptInvite: (inviteId: string): Promise<ApiResponse<Household>> =>
        post<Household>(`/households/invites/${inviteId}/accept`, {}),

      declineInvite: (inviteId: string): Promise<ApiResponse<null>> =>
        post<null>(`/households/invites/${inviteId}/decline`, {}),

      leave: (): Promise<ApiResponse<null>> =>
        post<null>("/households/me/leave", {}),
    },

    notifications: {
      list: (): Promise<ApiResponse<NotificationListResponse>> =>
        get<NotificationListResponse>("/notifications"),

      markSeen: (notificationId: string): Promise<ApiResponse<null>> =>
        post<null>(`/notifications/${notificationId}/seen`, {}),

      markAllSeen: (): Promise<ApiResponse<null>> =>
        post<null>("/notifications/seen-all", {}),
    },
  };
}
