# packages/shared

Shared TypeScript code used by both frontend apps (`apps/web`, `apps/mobile`) and the backend (`backend`).

## Why a shared package

Without this package, types and API contract definitions would need to be duplicated across web, mobile, and backend — and they'd drift. The shared package is the single source of truth for the API surface, which means:

- A type change in one place propagates everywhere at compile time
- The API client is written once and tested once
- Common utilities don't get copy-pasted

## Contents

### `src/types/index.ts`

All TypeScript types and interfaces for the domain model. These mirror the database schema and the API response shapes.

Key types:
- `Recipe`, `RecipeWithDetails`, `RecipeIngredient`, `RecipeStep`, `RecipeTag`
- `CreateRecipeInput`, `UpdateRecipeInput`, `ImportRecipeInput`
- `PantryItem`, `ShoppingList`, `FermentationBatch`, `MealPlan` (defined, not yet implemented)
- `ApiResponse<T>`, `ApiSuccess<T>`, `ApiError` — the response envelope every endpoint uses

### `src/api/index.ts`

A typed API client factory. Call `createApiClient(baseUrl, token)` to get a client with methods for every endpoint:

```typescript
const api = createApiClient("https://api.souschef.app", idToken);

const res = await api.recipes.list({ limit: 20, offset: 0 });
if ("error" in res) {
  // res.error.code, res.error.message
} else {
  // res.data.recipes
}
```

The client is a thin wrapper around `fetch` — it adds the `Authorization` header, serialises request bodies as JSON, and types the response. It does not handle retries or caching — that's the responsibility of the calling app.

Each app creates the client via its own `lib/api.ts` file, which fetches the Cognito session token before calling `createApiClient`.

### `src/utils/`

Pure utility functions with no dependencies. Available for use anywhere.

### `src/constants/`

Shared constants — limits, defaults, enums that need to be the same across the stack.

## Usage

The package is referenced as `@souschef/shared` in the monorepo workspace. Import directly:

```typescript
import type { Recipe, CreateRecipeInput } from "@souschef/shared";
import { createApiClient } from "@souschef/shared";
```

## Adding new types or endpoints

1. Add the type to `src/types/index.ts`
2. Add the API method to `src/api/index.ts`
3. The change is immediately available in all apps — TypeScript will flag any breaking changes
