import { fetchAuthSession } from "aws-amplify/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { runWithAmplifyServerContext } from "@/lib/server-auth";
import { sanitiseRedirect } from "@/lib/safe-redirect";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/confirm",
  "/forgot-password",
  "/reset-password",
  "/r",
  "/privacy",
  "/terms",
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isAuthenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response: NextResponse.next() },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        return !!session.tokens;
      } catch {
        return false;
      }
    },
  });

  if (!isAuthenticated && !isPublicRoute) {
    // Community recipe detail pages are publicly viewable via /r/[id].
    // Redirect unauthenticated users there instead of to sign-in.
    const communityRecipeMatch = pathname.match(/^\/community\/([^/]+)$/);
    if (communityRecipeMatch) {
      return NextResponse.redirect(new URL(`/r/${communityRecipeMatch[1]}`, request.url));
    }

    const signInUrl = new URL("/sign-in", request.url);
    // Include the query string, not just the pathname — a deep link like
    // /recipes?tag=bread should come back intact, not stripped to /recipes.
    signInUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages (but not the landing page or legal pages)
  const AUTH_ONLY_PUBLIC = [
    "/sign-in",
    "/sign-up",
    "/confirm",
    "/forgot-password",
    "/reset-password",
  ];
  const isAuthPage = AUTH_ONLY_PUBLIC.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isAuthenticated && isAuthPage) {
    // An already-signed-in user hitting an auth page should still be honoured if
    // they arrived via a deep link — e.g. following a shared recipe URL in a
    // second tab. sanitiseRedirect rejects anything off-origin.
    const target = sanitiseRedirect(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
