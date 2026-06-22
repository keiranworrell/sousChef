# apps/mobile

The sousChef mobile app, built with Expo 52 and React Native.

## Why Expo

- **Managed workflow** handles native build complexity — no Xcode/Android Studio required for most development
- **Expo Router** gives file-based routing that mirrors the Next.js App Router pattern, so the mental model is consistent across web and mobile
- **EAS (Expo Application Services)** handles CI builds and app store submissions
- Sharing types and the API client from `@souschef/shared` means the mobile app and web app stay in sync without duplicating logic

## Structure

```
apps/mobile/
├── app/
│   ├── (auth)/              # Auth screens — sign-in, sign-up, confirm
│   │   ├── _layout.tsx      # Auth stack navigator
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── confirm.tsx
│   ├── (app)/               # Authenticated screens
│   │   ├── _layout.tsx      # App tab/stack navigator, session guard
│   │   ├── index.tsx        # Redirects to /(app)/recipes
│   │   └── recipes/
│   │       ├── index.tsx    # Recipe list + URL import modal
│   │       ├── [id].tsx     # Recipe detail
│   │       ├── new.tsx      # Create recipe form
│   │       └── [id]/edit.tsx
│   └── _layout.tsx          # Root layout — Amplify provider
├── components/              # Mobile-specific components
├── hooks/                   # Mobile-specific hooks
├── lib/
│   ├── amplify-config.ts    # AWS Amplify v6 Cognito config (hardcoded public values)
│   └── api.ts               # Typed API client factory — fetches Cognito token, wraps shared client
└── assets/                  # Icons, splash screen images
```

## Auth

Uses **AWS Amplify v6** with the same Cognito User Pool as the web app, but a separate mobile app client (different `clientId`). The mobile client ID is hardcoded in `lib/amplify-config.ts` — it's a public value.

Session handling is identical to the web: `fetchAuthSession()` retrieves the ID token, which is passed as `Authorization: Bearer <token>` on API requests.

Route protection works via a session check in `(app)/_layout.tsx` — unauthenticated users are redirected to the auth stack.

## API calls

Same pattern as web via `lib/api.ts`:

```typescript
const api = await getApiClient();
const res = await api.recipes.list();
```

**Note on `process.env`:** React Native polyfills `process` at runtime but TypeScript doesn't know about it without `@types/node`. To avoid importing all of Node's types, `lib/api.ts` uses a local type declaration:

```typescript
declare const process: { env: Record<string, string | undefined> };
```

This is intentional — don't remove it or replace it with an import.

## Running locally

```bash
pnpm --filter @souschef/mobile start
```

This starts the Expo dev server. From there:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan the QR code with the Expo Go app on a physical device

Requires `apps/mobile/.env.local` with:

```
EXPO_PUBLIC_API_URL=https://<api-gateway-url>
```

The Cognito values are hardcoded in `lib/amplify-config.ts` because Expo's `EXPO_PUBLIC_*` env vars are baked into the build at bundle time, and the User Pool ID and client IDs are not secrets.

## Building for release

Builds are managed by Expo EAS:

```bash
# Production build (triggers EAS cloud build)
eas build --platform all --profile production

# Submit to app stores
eas submit --platform all
```

EAS credentials and configuration are in `eas.json` (not committed — contains store credentials).

## Environment variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API Gateway invoke URL |
