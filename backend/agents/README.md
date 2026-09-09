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

### `dietary-adaptation.ts` *(stub — not wired to any route)*
Adapts a recipe to meet a dietary requirement (e.g. vegan, gluten-free, nut-free). Returns a modified recipe with substituted ingredients and any notes on how the dish will differ.

### `fermentation-troubleshoot.ts` *(stub — not wired to any route)*
AI troubleshooting assistant for fermentation batches. Takes the batch details, timeline logs, and the user's problem description, and suggests likely causes and remediation steps.

## Removed agents

Three stubs were deleted once the features they were written for shipped
without them. Each was superseded by a simpler, cheaper approach, and leaving
them in place made the codebase look like it had more AI surface than it does:

| Agent | Replaced by |
|---|---|
| `substitution.ts` | A static substitution data file in `packages/shared` |
| `pantry-to-recipe.ts` | A SQL query helper behind `GET /pantry/suggestions` |
| `scaling.ts` | `scaleQuantity`, a pure utility in `packages/shared` |

They remain in git history if an AI-backed version is ever wanted. Worth noting
the pattern before reaching for a fourth: in all three cases the non-AI version
turned out to be sufficient, faster, and free to run.

## Adding a new agent

1. Create `backend/agents/<name>.ts`
2. Export a typed async function (not a Lambda handler — agents are modules called by handlers)
3. If using Claude: define `SYSTEM_PROMPT` as a named constant at the top of the file; validate the response with Zod
4. Call it from the relevant function handler in `backend/functions/`
5. Add a brief description to this README
