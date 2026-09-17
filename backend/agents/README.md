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

## Removed agents

Five stubs have been deleted. The first three were superseded by simpler,
cheaper approaches; the last two were never written at all. Leaving any of them
in place made the codebase look like it had more AI surface than it does:

| Agent | Why it went |
|---|---|
| `substitution.ts` | A static substitution data file in `packages/shared` |
| `pantry-to-recipe.ts` | Removed with pantry tracking |
| `scaling.ts` | `scaleQuantity`, a pure utility in `packages/shared` |
| `dietary-adaptation.ts` | Never implemented — empty prompt, no route, 18 months |
| `fermentation-troubleshoot.ts` | Never implemented — empty prompt, no route |

They remain in git history if an AI-backed version is ever wanted, though for
the last two there is nothing in history to recover: both were an import block,
`SYSTEM_PROMPT = ""`, a TODO and `okResponse(null)`. Writing them fresh would be
easier than resurrecting them.

Worth noting the pattern before reaching for a sixth. Three times the non-AI
version turned out to be sufficient, faster and free to run; twice the feature
simply was not wanted enough to finish.

## Adding a new agent

1. Create `backend/agents/<name>.ts`
2. Export a typed async function (not a Lambda handler — agents are modules called by handlers)
3. If using Claude: define `SYSTEM_PROMPT` as a named constant at the top of the file; validate the response with Zod
4. Call it from the relevant function handler in `backend/functions/`
5. Add a brief description to this README
