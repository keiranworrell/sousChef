# sousChef

A recipe management and cooking companion app for home cooks, bakers, and fermentation enthusiasts. Built as a side project targeting a freemium subscription model.

## What it does

- **Recipe management** — create, edit, import from URL, scale, and organise recipes
- **Cooking mode** — fullscreen step-by-step guided cooking with per-step timers
- **AI tools** — ingredient substitution, smart scaling, dietary adaptation, and recipe import parsing
- **Pantry tracking** — stock levels, expiry alerts, low-stock notifications
- **Shopping lists** — auto-generated from recipes with pantry deduction
- **Fermentation tracker** — long-term batch projects with timeline logs, photo journals, and an AI troubleshooting assistant
- **Meal planning** — weekly drag-and-drop planner
- **Community** — public recipe sharing, bookmarking, collections, and recipe forking

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Web | Next.js 15 (App Router) | Strong React ecosystem, built-in server components, easy Vercel deployment |
| Mobile | Expo 52 + React Native | Share logic/types with web, single codebase for iOS and Android |
| Backend | AWS Lambda + API Gateway | Pay-per-request, zero ops, scales to zero when idle — right for a side project |
| Database | Neon (serverless Postgres) | Serverless Postgres that also scales to zero; Drizzle ORM for type safety |
| Auth | AWS Cognito | Handles email/password and Google OAuth, integrates cleanly with Lambda JWT validation |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | Best-in-class instruction following and structured JSON output for agents |
| Infra as code | Terraform | Full audit trail of infrastructure, safe to destroy and recreate |
| Hosting (web) | Vercel | Zero-config Next.js deployments, preview URLs per PR |
| Hosting (mobile) | Expo EAS | Managed iOS/Android builds and app store submissions |
| Monorepo | Turborepo + pnpm | Shared packages (types, API client), parallel task execution, caching |

## Repo structure

```
souschef/
├── apps/
│   ├── web/          # Next.js web app (see apps/web/README.md)
│   └── mobile/       # Expo React Native app (see apps/mobile/README.md)
├── packages/
│   └── shared/       # Shared types, API client, utilities (see packages/shared/README.md)
├── backend/          # Lambda functions, middleware, AI agents (see backend/README.md)
├── infrastructure/   # Terraform (see infrastructure/terraform/README.md)
├── migrations/       # Drizzle SQL migration files
├── .github/          # CI/CD workflows (GitHub Actions)
└── CLAUDE.md         # AI agent context — conventions, architecture decisions, commit style
```

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- AWS CLI configured (for infrastructure work)
- Terraform 1.9+ (for infrastructure work)

### Setup

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
cp backend/.env.example backend/.env.local

# Run everything in dev mode
pnpm dev
```

### Individual apps

```bash
# Web only
pnpm --filter @souschef/web dev

# Mobile only (starts Expo dev server)
pnpm --filter @souschef/mobile start

# Backend type-check
pnpm --filter @souschef/backend typecheck
```

### CI tasks (run before pushing)

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # TypeScript strict checks across all packages
pnpm test        # Vitest unit tests
pnpm build       # Production build (web + shared packages)
```

## Environment variables

Each app has its own `.env.example`. The key variables are:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `apps/web` | API Gateway invoke URL |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `apps/web` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `apps/web` | Cognito web app client ID |
| `EXPO_PUBLIC_API_URL` | `apps/mobile` | API Gateway invoke URL |
| `DATABASE_URL` | `backend` | Neon Postgres connection string |
| `COGNITO_USER_POOL_ID` | `backend` | For JWT validation in Lambda |
| `COGNITO_CLIENT_IDS` | `backend` | Comma-separated web + mobile client IDs |

Sensitive values (database URL, API keys) are stored in AWS Secrets Manager for deployed Lambdas — not in environment variables.

## Database migrations

Migrations live in `migrations/` and are managed by Drizzle Kit.

```bash
# Generate a new migration after changing the schema
npx drizzle-kit generate

# Apply migrations to a database
DATABASE_URL=<connection-string> npx drizzle-kit migrate
```

## Deployment

Deployment is fully automated via GitHub Actions:

- **On PR**: lint, typecheck, test, build, `terraform plan` (plan posted as PR comment)
- **On merge to main**: `terraform apply`, Lambda bundle deployed

See `.github/workflows/` for the full pipeline.

## Contributing

See `CLAUDE.md` for the full conventions guide — commit style, branch naming, API design, TypeScript rules, and testing expectations. That document is also the primary context file for AI agents working on this codebase.
