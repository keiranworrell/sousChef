# backend/agents

AI-powered modules that handle tasks requiring language model reasoning. Each agent has a single, focused responsibility.

## Why Claude (`claude-sonnet-4-6`)

- Excellent instruction following for returning structured JSON with no preamble
- Strong performance on cooking-domain tasks (ingredient knowledge, recipe understanding)
- Consistent output format makes Zod parsing reliable
- `claude-sonnet-4-6` balances capability and cost well for these use cases

## Agent pattern

All agents follow the same structure:

1. **Input** — typed function arguments
2. **Processing** — fetch external data if needed, build the Claude prompt
3. **Output** — call the Claude API, parse the response with Zod, return typed result
4. **Error handling** — if parsing fails, return a structured error — never let a malformed response reach the client

Agents that don't need Claude (like `recipe-import.ts`) follow the same input/output interface but use deterministic parsing instead.

## Agents

### `recipe-import.ts`
Imports a recipe from a URL by parsing Schema.org structured data (`application/ld+json`). Most major recipe sites (BBC Good Food, NYT Cooking, AllRecipes, etc.) publish Schema.org `Recipe` objects, so this works without an AI call for ~80% of sites.

**How it works:**
1. Fetches the page HTML server-side (with a browser-like User-Agent to avoid bot blocking)
2. Extracts all `<script type="application/ld+json">` blocks
3. Finds a `@type: Recipe` object — handles direct, array, and `@graph` wrapper patterns
4. Maps Schema.org fields to `CreateRecipeInput`:
   - `name` → `title`
   - `recipeIngredient[]` → `ingredients[]` (name only; structured quantity parsing is future work)
   - `recipeInstructions` → `steps[]` (handles string, string[], and HowToStep[] variants)
   - `prepTime` / `cookTime` → ISO 8601 duration parsed to minutes
   - `recipeYield` → `servings` (extracts first integer from strings like "4 servings")
   - `recipeCuisine`, `keywords`, `image`, `description` → direct mapping
5. Returns `{ ok: true, recipe }` or `{ ok: false, error }` — never throws

A Claude fallback for sites without structured data is planned for a future iteration.

### `substitution.ts` *(stub — not yet implemented)*
Suggests ingredient substitutions for a given recipe ingredient, taking into account dietary restrictions and what the user has available in their pantry.

### `scaling.ts` *(stub — not yet implemented)*
Intelligently scales a recipe by a given factor. Goes beyond simple multiplication — adjusts cooking times, temperatures, and pan sizes where appropriate, and flags ingredients that don't scale linearly (e.g. salt, leavening agents, spices).

### `dietary-adaptation.ts` *(stub — not yet implemented)*
Adapts a recipe to meet a dietary requirement (e.g. vegan, gluten-free, nut-free). Returns a modified recipe with substituted ingredients and any notes on how the dish will differ.

### `pantry-to-recipe.ts` *(stub — not yet implemented)*
Suggests recipes the user can make from what's currently in their pantry, optionally with a short shopping list for any missing ingredients.

### `fermentation-troubleshoot.ts` *(stub — not yet implemented)*
AI troubleshooting assistant for fermentation batches. Takes the batch details, timeline logs, and the user's problem description, and suggests likely causes and remediation steps.

## Adding a new agent

1. Create `backend/agents/<name>.ts`
2. Export a typed async function (not a Lambda handler — agents are modules called by handlers)
3. If using Claude: define `SYSTEM_PROMPT` as a named constant at the top of the file; validate the response with Zod
4. Call it from the relevant function handler in `backend/functions/`
5. Add a brief description to this README
