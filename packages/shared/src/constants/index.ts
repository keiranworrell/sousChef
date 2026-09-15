export * from "./substitutions";

export const MAX_RECIPE_IMAGES = 10 as const;
export const MAX_STEP_IMAGES = 1 as const;
export const DEFAULT_SERVINGS = 4 as const;
export const MAX_RECIPE_TITLE_LENGTH = 120 as const;
export const MAX_TAGS_PER_RECIPE = 10 as const;
/**
 * AI imports a free account gets, lifetime. The point is to let someone see the
 * feature work before being asked to pay for it — a hard paywall on the
 * flagship feature asks people to buy something they have never seen do
 * anything.
 */
export const FREE_TIER_AI_IMPORTS = 5 as const;

export const PAGINATION_DEFAULT_LIMIT = 20 as const;
export const PAGINATION_MAX_LIMIT = 100 as const;
