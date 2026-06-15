# sousChef — Agent Context

This file is the primary context document for AI agents working on the sousChef codebase.
Read it fully before making any changes. It defines what the product is, how the codebase
is structured, and the conventions every contributor (human or agent) must follow.

---

## What is sousChef?

sousChef is a recipe management and cooking companion web and mobile application. It is
built and maintained by a solo developer as a side project, targeting home cooks, keen
bakers, and fermentation enthusiasts.

### Core Features

- **Recipe management** — create, edit, import (from URL), scale, and organise recipes
- **Cooking mode** — fullscreen guided step-by-step cooking with per-step timers and screen wake lock
- **AI-powered tools** — ingredient substitution, smart scaling, dietary adaptation, and recipe import parsing
- **Pantry management** — track what you have at home, with expiry alerts and low-stock notifications
- **Shopping lists** — auto-generated from recipes with smart deduction against pantry contents
- **Fermentation tracker** — long-term batch projects with timeline logging, photo journals, reminders, and an AI troubleshooting assistant
- **Meal planning** — weekly drag-and-drop planner with auto-generated shopping lists
- **Community** — public recipe sharing, bookmarking, collections, comments, and recipe forking

### Who it's for

Home cooks who want one place to manage their recipes, plan their meals, track their
pantry, and get intelligent help when they need it. The fermentation and patisserie angles
are a deliberate niche focus — users who take cooking seriously but aren't professionals.

---

## Tech Stack

### Languages

- **TypeScript** throughout — all frontend, backend, and shared packages. Strict mode enabled everywhere.
- No JavaScript files should be created. If you encounter `.js` files outside of config files that require it, flag them.

### Monorepo

Managed with **Turborepo**. Root `package.json` defines workspaces. All tasks (build,
lint, test, dev) are defined in `turbo.json` and run with `turbo run <task>`.

### Apps

| App | Path | Framework | Purpose |
|---|---|---|---|
| Web | `apps/web` | Next.js (App Router) | Main web application |
| Mobile | `apps/mobile` | Expo (React Native) | iOS and Android mobile app |

### Packages

| Package | Path | Purpose |
|---|---|---|
| shared | `packages/shared` | Types, API client, utilities, constants shared across all apps |
| ui | `packages/ui` | Shared UI components (where web and mobile can share) |

### Backend

| Directory | Purpose |
|---|---|
| `backend/functions` | Lambda function handlers, one file per domain (recipes, pantry, shopping, fermentation, mealplans, users) |
| `backend/middleware` | Shared Lambda middleware — auth validation, error handling, request parsing |
| `backend/agents` | AI agent Lambda functions, one per agent type |
| `backend/db` | Drizzle ORM schema, client setup, and query helpers |

### Infrastructure

All infrastructure is defined as code using **Terraform** in `infrastructure/terraform`.

| Directory | Purpose |
|---|---|
| `infrastructure/terraform/modules` | Reusable Terraform modules |
| `infrastructure/terraform/environments/prod` | Production environment root module |
| `infrastructure/terraform/environments/staging` | Staging environment (future) |

### Key Services

| Service | What it does |
|---|---|
| **AWS Lambda** | All backend API handlers and AI agents |
| **AWS API Gateway (HTTP API)** | Routes HTTP requests to Lambda functions |
| **AWS Cognito** | User authentication (email/password + Google OAuth) |
| **AWS S3** | Image storage for recipe and fermentation photos |
| **AWS CloudFront** | CDN in front of S3 |
| **AWS Secrets Manager** | Stores sensitive config (DB connection string, API keys) |
| **AWS EventBridge** | Scheduled triggers for fermentation reminders |
| **Neon (Postgres)** | Primary database — serverless Postgres |
| **Drizzle ORM** | Database schema, migrations, and type-safe queries |
| **Vercel** | Hosts the Next.js web app |
| **Expo EAS** | Builds and submits the mobile app to app stores |
| **Anthropic Claude API** | Powers all AI agent features (model: `claude-sonnet-4-6`) |

---

## Folder Structure

```
souschef/
├── apps/
│   ├── web/                        # Next.js web app
│   │   ├── app/                    # App Router pages and layouts
│   │   ├── components/             # Web-specific components
│   │   ├── hooks/                  # Web-specific React hooks
│   │   ├── lib/                    # Web-specific utilities
│   │   └── public/                 # Static assets
│   └── mobile/                     # Expo React Native app
│       ├── app/                    # Expo Router screens
│       ├── components/             # Mobile-specific components
│       └── hooks/                  # Mobile-specific hooks
├── packages/
│   ├── shared/                     # Shared across all apps and backend
│   │   ├── src/
│   │   │   ├── types/              # All TypeScript types and interfaces
│   │   │   ├── api/                # API client (typed fetch wrapper)
│   │   │   ├── utils/              # Pure utility functions
│   │   │   └── constants/          # Shared constants
│   └── ui/                         # Shared UI components
│       └── src/
│           └── components/
├── backend/
│   ├── functions/                  # Lambda handlers
│   │   ├── recipes.ts
│   │   ├── pantry.ts
│   │   ├── shopping.ts
│   │   ├── fermentation.ts
│   │   ├── mealplans.ts
│   │   └── users.ts
│   ├── middleware/
│   │   ├── auth.ts                 # Cognito JWT validation
│   │   ├── errors.ts               # Error handling and response shaping
│   │   └── validation.ts           # Request body validation (Zod)
│   ├── agents/
│   │   ├── substitution.ts
│   │   ├── scaling.ts
│   │   ├── pantry-to-recipe.ts
│   │   ├── fermentation-troubleshoot.ts
│   │   ├── recipe-import.ts
│   │   └── dietary-adaptation.ts
│   └── db/
│       ├── schema/                 # Drizzle table definitions
│       ├── client.ts               # Neon + Drizzle client setup
│       └── queries/                # Reusable typed query helpers
├── infrastructure/
│   └── terraform/
│       ├── modules/                # Reusable modules (lambda, cognito, s3, etc.)
│       └── environments/
│           └── prod/               # Production root module
├── migrations/                     # Drizzle migration files (auto-generated)
├── .github/
│   ├── workflows/                  # GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── turbo.json
├── package.json                    # Root workspace config
└── GEMINI.md                       # This file
```

---

## Conventions

### TypeScript

- **Strict mode** is enabled in all `tsconfig.json` files. Do not disable any strict checks.
- Prefer `type` over `interface` for object shapes unless declaration merging is needed.
- Avoid `any`. Use `unknown` when the type is genuinely unknown, then narrow.
- All exported functions must have explicit return types.
- Use Zod for runtime validation of external inputs (API request bodies, API responses, env vars).

### Naming

| Thing | Convention | Example |
|---|---|---|
| Variables and functions | camelCase | `recipeIngredients`, `getRecipeById` |
| React components | PascalCase | `RecipeCard`, `CookingMode` |
| Types and interfaces | PascalCase | `Recipe`, `PantryItem` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RECIPE_IMAGES`, `DEFAULT_SERVINGS` |
| Files (non-component) | kebab-case | `recipe-utils.ts`, `auth-middleware.ts` |
| Files (component) | PascalCase | `RecipeCard.tsx`, `CookingMode.tsx` |
| Database tables | snake_case | `recipe_ingredients`, `pantry_items` |
| Database columns | snake_case | `created_at`, `user_id` |
| API routes | kebab-case | `/recipes/:id/ingredients`, `/meal-plans` |
| JSON keys (API responses) | camelCase | `{ "recipeId": "...", "createdAt": "..." }` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `ANTHROPIC_API_KEY` |

### File Organisation

- One component per file.
- Co-locate tests with source: `RecipeCard.tsx` and `RecipeCard.test.tsx` in the same directory.
- Co-locate styles with components when using CSS modules. Prefer Tailwind utilities in JSX.
- Keep Lambda handler files thin — business logic lives in `db/queries` or shared utilities, not inline in the handler.

### API Design

All API responses follow this envelope format:

```typescript
// Success
{ "data": <payload> }

// Error
{
  "error": {
    "code": "RECIPE_NOT_FOUND",    // Screaming snake case, machine-readable
    "message": "Recipe not found", // Human-readable
    "details": {}                  // Optional additional context
  }
}
```

- HTTP status codes must be semantically correct (200, 201, 400, 401, 403, 404, 409, 422, 500).
- Auth is via `Authorization: Bearer <token>` header on all protected routes.
- All IDs are UUIDs (v4), never auto-increment integers.
- All timestamps are ISO 8601 strings in UTC.
- Pagination uses `{ limit, offset, total }` query params and response fields.

### AI Agents

All agents in `backend/agents/` follow this pattern:

- Each agent is a focused Lambda with a single responsibility.
- System prompts are defined as a named constant at the top of the file.
- All agents return structured JSON. The system prompt must instruct the model to return only valid JSON with no preamble or markdown fences.
- Parse responses with a Zod schema. If parsing fails, return a structured error — never let a malformed agent response reach the client.
- Use `claude-sonnet-4-6` for all agent calls unless there is a documented reason to use another model.
- Include relevant context (recipe, pantry contents, batch history) in the user message, not the system prompt.

### Environment Variables

- Never commit `.env` files. Every environment variable must be documented in `.env.example` with a description comment and a placeholder value.
- Access env vars through a validated config module (`lib/config.ts` or equivalent) using Zod, not `process.env` directly throughout the codebase.
- Lambda functions retrieve secrets from AWS Secrets Manager at cold start, not via environment variables, for anything sensitive (database connection strings, API keys).

### Testing

- **Unit tests**: Vitest. Cover pure utility functions, query helpers, and agent prompt/response parsing logic.
- **Component tests**: Vitest + React Testing Library for web components.
- **Integration tests**: Test Lambda handlers with mocked DB and AWS SDK calls.
- Test files are co-located with source: `foo.ts` → `foo.test.ts`.
- Test descriptions use plain English that reads as a sentence: `it('returns 404 when recipe does not exist')`.
- Do not test implementation details. Test behaviour and outcomes.
- Minimum coverage expectation: all utility functions and query helpers. UI components are tested for key interactions, not exhaustive rendering.

### Terraform

- All resources must have a `Name` tag and a `Project = "souschef"` tag.
- Use modules for anything deployed more than once (e.g. each Lambda function).
- Do not hardcode values that differ between environments. Use variables with sensible defaults.
- Remote state is stored in S3 with a DynamoDB lock table. Never use local state.
- Run `terraform fmt` before committing any `.tf` file.
- Terraform plan output is posted as a PR comment automatically by CI. Do not apply manually.

---

## Commit Style

sousChef uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #<issue>]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Maintenance, dependency updates, config changes |
| `docs` | Documentation only |
| `refactor` | Code change that isn't a feature or fix |
| `test` | Adding or updating tests |
| `ci` | Changes to GitHub Actions or CI config |
| `infra` | Terraform or infrastructure changes |

**Scope** is the area of the codebase affected: `recipes`, `pantry`, `auth`, `web`, `mobile`, `agents`, `terraform`, `ci`, etc.

**Examples:**

```
feat(recipes): add cooking mode with per-step timers
fix(auth): handle expired Cognito token on refresh
infra(terraform): add S3 bucket for recipe image uploads
ci: add Terraform plan workflow on PR
test(agents): add unit tests for substitution agent response parsing
```

- Use the imperative present tense: "add" not "added", "fix" not "fixes".
- Keep the subject line under 72 characters.
- Reference the closing issue in the footer: `Closes #42`.

---

## Branch Naming

```
<type>/issue-<number>-<brief-description>
```

Examples:
- `feat/issue-34-recipe-crud-endpoints`
- `fix/issue-87-pantry-expiry-alert`
- `ci/issue-7-nextjs-ci-workflow`
- `infra/issue-15-terraform-bootstrap`

---

## Pull Requests

- Title must follow conventional commit format: `feat(recipes): add cooking mode`
- Body must reference the closing issue: `Closes #<n>`
- All CI checks must pass before merge
- Squash merge into `main` — keep the commit history clean
- Do not merge your own PR without review if a human reviewer is available

---

## Working with Issues

Each GitHub issue represents one unit of work. When picking up an issue:

1. Read the full issue including acceptance criteria and tech notes
2. Create a branch following the naming convention above
3. Make the changes described — no more, no less. If you identify adjacent work needed, open a new issue rather than expanding scope
4. Ensure tests pass locally: `turbo run test`
5. Ensure linting passes: `turbo run lint`
6. Open a PR referencing the issue

If an issue's requirements are unclear or contradictory, leave a comment on the issue rather than making assumptions.
