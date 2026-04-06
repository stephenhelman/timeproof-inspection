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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requires2FA = !!(auth as any)?.requires2FA;
      const pathname = nextUrl.pathname;

      // Always allow: NextAuth internals, public report, report API
      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/summary") ||
        pathname.startsWith("/api/report")
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
        if (pathname.startsWith("/login/verify")) return true;
        // Redirect everything else (app routes, other auth pages) to verify
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
