import type { NextAuthConfig } from "next-auth";

// Edge-safe config — NO Prisma, NO adapter.
// Used by middleware for JWT session checks only.
export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Edge-safe: reads from the decoded JWT only — no DB access.
    // Without this, NextAuth v5 only maps standard OIDC claims to the session
    // object, so custom claims like requires2FA are invisible to the middleware
    // and the authorized() callback below always sees it as undefined/false.
    session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).requires2FA = (token as any).requires2FA ?? false;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requires2FA = !!(auth as any)?.requires2FA;
      const pathname = nextUrl.pathname;

      // Always allow: NextAuth internals, public report, report API, business card
      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/summary") ||
        pathname.startsWith("/api/report") ||
        pathname.startsWith("/card") ||
        (pathname.startsWith("/api/user/") && pathname.endsWith("/card"))
      ) {
        return true;
      }

      // Not logged in — only allow public auth pages
      if (!isLoggedIn) {
        const isPublicPage =
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/forgot-password");
        return isPublicPage ? true : false;
      }

      // Logged in with 2FA still required
      if (requires2FA) {
        // Allow /login so the user can re-authenticate if the code expired
        // or if they arrived with a stale requires2FA JWT from a previous session
        if (pathname.startsWith("/login")) return true;
        // Block all app routes until 2FA is completed
        return Response.redirect(new URL("/login/verify", nextUrl));
      }

      // Fully authenticated — redirect away from auth pages
      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password");
      if (isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
};
