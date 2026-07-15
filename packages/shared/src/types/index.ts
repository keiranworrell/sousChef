// ─── Common ────────────────────────────────────────────────────────────────────

export type UUID = string;

export type ISODateString = string;

export type PaginationParams = {
  limit: number;
  offset: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

// ─── API envelope ──────────────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  data: T;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── User ──────────────────────────────────────────────────────────────────────

export type User = {
  id: UUID;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  dietaryPreferences: string[] | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  followerCount: number;
  followingCount: number;
};

export type UserProfile = {
  id: UUID;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export type PublicUserListItem = {
  id: UUID;
  displayName: string;
  avatarUrl: string | null;
  followerCount: number;
  isFollowing: boolean;
};

export type UserFollowListResponse = {
  users: PublicUserListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type UpdateUserInput = {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dietaryPreferences?: string[] | null;
};

// ─── Recipe ────────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export type Recipe = {
  id: UUID;
  userId: UUID;
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  difficulty: Difficulty | null;
  cuisine: string | null;
  isPublic: boolean;
  sourceUrl: string | null;
  forkedFromId: string | null;
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type RecipeIngredient = {
  id: UUID;
  recipeId: UUID;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  orderIndex: number;
};

export type RecipeStep = {
  id: UUID;
  recipeId: UUID;
  stepNumber: number;
  instruction: string;
  timerSeconds: number | null;
  imageUrl: string | null;
};

export type RecipeTag = {
  id: UUID;
  recipeId: UUID;
  tag: string;
};

export type RecipeWithDetails = Omit<Recipe, "tags"> & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: RecipeTag[];
};

export type CreateIngredientInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  orderIndex: number;
};

export type CreateStepInput = {
  stepNumber: number;
  instruction: string;
  timerSeconds?: number | null;
};

export type CreateRecipeInput = {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  servings?: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  difficulty?: Difficulty | null;
  cuisine?: string | null;
  isPublic?: boolean;
  sourceUrl?: string | null;
  ingredients?: CreateIngredientInput[];
  steps?: CreateStepInput[];
  tags?: string[];
};

export type ImportRecipeInput = {
  url: string;
};

export type UpdateRecipeInput = Partial<
  Omit<CreateRecipeInput, "ingredients" | "steps" | "tags">
> & { tags?: string[] };

export type ListRecipesResponse = {
  recipes: Recipe[];
  total: number;
  limit: number;
  offset: number;
};

export type CommunityFeedParams = {
  q?: string;
  cuisine?: string;
  tag?: string;
  creator?: string;
  creatorId?: string;
  sort?: "popular";
  limit?: number;
  offset?: number;
};

export type CommunityRecipe = RecipeWithDetails & {
  creatorName: string;
  creatorId: string;
  likeCount: number;
  isLiked: boolean;
  forkCount: number;
};

export type CommunityFeedResponse = {
  recipes: CommunityRecipe[];
  total: number;
  limit: number;
  offset: number;
};

// ─── Feed ──────────────────────────────────────────────────────────────────────

export type FeedActivityType = "new_recipe" | "cooked_recipe";

export type FeedActivity = {
  id: string;
  type: FeedActivityType;
  occurredAt: ISODateString;
  user: {
    id: UUID;
    displayName: string;
    avatarUrl: string | null;
  };
  recipe: {
    id: UUID;
    title: string;
    imageUrl: string | null;
  };
};

export type FeedResponse = {
  activities: FeedActivity[];
  total: number;
};

// ─── Rediscover ────────────────────────────────────────────────────────────────

export type RediscoverMode = "cook-again" | "never-tried";

export type RediscoverRecipe = {
  id: UUID;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  cookTimeMinutes: number | null;
  tags: string[];
  lastCookedAt: ISODateString | null;
};

export type RediscoverResponse = {
  recipes: RediscoverRecipe[];
  mode: RediscoverMode;
};

// ─── Cook history ──────────────────────────────────────────────────────────────

export type CookHistoryEntry = {
  id: UUID;
  userId: UUID;
  recipeId: UUID;
  cookedAt: ISODateString;
  recipe: {
    title: string;
    imageUrl: string | null;
  };
};

export type CookHistoryResponse = {
  entries: CookHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
};

// ─── Pantry ────────────────────────────────────────────────────────────────────

export type PantryItem = {
  id: UUID;
  userId: UUID;
  name: string;
  quantity: number | null;
  unit: string | null;
  expiryDate: ISODateString | null;
  lowStockThreshold: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CreatePantryItemInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  expiryDate?: ISODateString | null;
  lowStockThreshold?: number | null;
};

export type UpdatePantryItemInput = Partial<CreatePantryItemInput>;

export type ListPantryItemsResponse = {
  items: PantryItem[];
};

// ─── Shopping ──────────────────────────────────────────────────────────────────

export type ShoppingList = {
  id: UUID;
  userId: UUID;
  name: string;
  isShared: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ShoppingListItem = {
  id: UUID;
  shoppingListId: UUID;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  orderIndex: number;
};

export type ShoppingListWithItems = ShoppingList & { items: ShoppingListItem[] };

export type CreateShoppingListInput = {
  name: string;
};

export type UpdateShoppingListInput = {
  name: string;
};

export type CreateShoppingListItemInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
};

export type UpdateShoppingListItemInput = Partial<CreateShoppingListItemInput> & {
  isChecked?: boolean;
};

export type ListShoppingListsResponse = {
  lists: ShoppingList[];
};

// ─── Fermentation ──────────────────────────────────────────────────────────────

export type FermentationStatus = "active" | "complete" | "abandoned";

export type FermentationBatch = {
  id: UUID;
  userId: UUID;
  recipeId: UUID | null;
  name: string;
  startedAt: ISODateString;
  targetEndDate: ISODateString | null;
  status: FermentationStatus;
  createdAt: ISODateString;
};

export type FermentationLog = {
  id: UUID;
  batchId: UUID;
  loggedAt: ISODateString;
  ph: number | null;
  saltPercent: number | null;
  temperatureCelsius: number | null;
  weightGrams: number | null;
  notes: string | null;
  imageUrl: string | null;
};

export type FermentationBatchWithLogs = FermentationBatch & {
  logs: FermentationLog[];
};

export type CreateFermentationBatchInput = {
  name: string;
  startedAt: ISODateString;
  targetEndDate?: ISODateString | null;
  recipeId?: UUID | null;
  status?: FermentationStatus;
};

export type UpdateFermentationBatchInput = Partial<CreateFermentationBatchInput>;

export type CreateFermentationLogInput = {
  loggedAt?: ISODateString;
  ph?: number | null;
  saltPercent?: number | null;
  temperatureCelsius?: number | null;
  weightGrams?: number | null;
  notes?: string | null;
};

export type UpdateFermentationLogInput = Partial<CreateFermentationLogInput>;

export type ListFermentationBatchesResponse = {
  batches: FermentationBatch[];
};

// ─── Meal plan ─────────────────────────────────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealPlan = {
  id: UUID;
  userId: UUID;
  weekStartDate: ISODateString;
  createdAt: ISODateString;
};

export type MealPlanEntryRecipe = {
  id: UUID;
  title: string;
  imageUrl: string | null;
  servings: number;
};

export type MealPlanEntry = {
  id: UUID;
  mealPlanId: UUID;
  recipeId: UUID;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  recipe: MealPlanEntryRecipe;
};

export type MealPlanWithEntries = MealPlan & { entries: MealPlanEntry[] };

export type CreateMealPlanEntryInput = {
  recipeId: UUID;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
};

// ─── Households ────────────────────────────────────────────────────────────────

export type HouseholdMember = {
  id: UUID;
  userId: UUID;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: ISODateString;
};

export type Household = {
  id: UUID;
  name: string;
  ownerId: UUID;
  createdAt: ISODateString;
  members: HouseholdMember[];
};

export type HouseholdInviteStatus = "pending" | "accepted" | "declined";

export type HouseholdInvite = {
  id: UUID;
  householdId: UUID;
  inviterId: UUID;
  inviteeId: UUID;
  status: HouseholdInviteStatus;
  createdAt: ISODateString;
};

// ─── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType = "household_invite";

export type NotificationData = {
  inviteId?:      UUID;
  householdId?:   UUID;
  householdName?: string;
  inviterId?:     UUID;
  inviterName?:   string;
  [key: string]:  unknown;
};

export type Notification = {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  referenceId: UUID | null;
  data: NotificationData | null;
  seenAt: ISODateString | null;
  createdAt: ISODateString;
};

export type NotificationListResponse = {
  notifications: Notification[];
  unreadCount: number;
};
