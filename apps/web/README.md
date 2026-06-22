# apps/web

The sousChef web application, built with Next.js 15 (App Router).

## Why Next.js

- **App Router** gives us React Server Components for fast initial loads and straightforward data fetching patterns
- **Vercel deployment** is zero-config — push to main and it's live, with automatic preview URLs per PR
- **Built-in routing** handles layouts, nested routes, and loading/error boundaries cleanly
- TypeScript and Tailwind are first-class citizens

## Structure

```
apps/web/
├── app/
│   ├── (auth)/              # Auth route group — sign-in, sign-up, confirm
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── confirm/
│   ├── (app)/               # Authenticated app shell (future: shared layout with nav)
│   ├── recipes/             # Recipe pages
│   │   ├── page.tsx         # Recipe list + URL import
│   │   ├── new/page.tsx     # Create recipe
│   │   └── [id]/
│   │       ├── page.tsx     # Recipe detail
│   │       └── edit/page.tsx
│   ├── layout.tsx           # Root layout — Amplify provider, global styles
│   ├── globals.css          # Tailwind base + component classes (.input, .btn-primary, etc.)
│   └── page.tsx             # Redirects to /recipes
├── components/
│   ├── RecipeCard.tsx       # Recipe summary card (link, title, difficulty, meta)
│   └── RecipeForm.tsx       # Shared create/edit form with dynamic ingredient/step rows
├── hooks/                   # Web-specific React hooks
├── lib/
│   ├── amplify-config.ts    # AWS Amplify initialisation (Cognito config)
│   └── api.ts               # Typed API client factory — fetches Cognito token, wraps shared client
└── public/                  # Static assets
```

## Auth

Authentication uses **AWS Amplify v6** talking to AWS Cognito. The flow:

1. User signs up → Cognito sends a verification email
2. User confirms with the code → Cognito fires a post-confirmation Lambda that creates the user record in Postgres
3. User signs in → Amplify stores the session; `fetchAuthSession()` retrieves the ID token
4. The ID token is attached as `Authorization: Bearer <token>` on every API request
5. The Lambda validates the JWT using `aws-jwt-verify` against the Cognito User Pool

The Cognito config (User Pool ID and client ID) is baked into `lib/amplify-config.ts` as public values — they are not secrets.

## API calls

All API calls go through `lib/api.ts`:

```typescript
const api = await getApiClient();
const res = await api.recipes.list();
```

`getApiClient()` fetches the current Cognito session token and passes it to `createApiClient` from `@souschef/shared`. All response types are fully typed via the shared package.

## Styling

Tailwind utility classes throughout. A small set of component classes are defined in `globals.css` to keep common patterns consistent:

- `.input` — standard form input
- `.label` — form label
- `.btn-primary` — orange filled button
- `.btn-secondary` — outlined button

## Running locally

```bash
pnpm --filter @souschef/web dev
```

Requires `apps/web/.env.local` with:

```
NEXT_PUBLIC_API_URL=https://<api-gateway-url>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-2_CtM4oVKs1
NEXT_PUBLIC_COGNITO_CLIENT_ID=<web-client-id>
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API Gateway invoke URL (set in Vercel dashboard) |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID — not a secret |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito web app client ID — not a secret |
