import type { NextAuthConfig } from "next-auth";

// Edge-safe config — NO Prisma, NO adapter.
// Used by middleware for JWT session checks only.
// session.strategy must be "jwt" so the middleware can verify sessions
// without DB access. The PrismaAdapter in auth.ts still handles user/account creation.
export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=true",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublicReport = nextUrl.pathname.startsWith("/summary");
      const isApiReport = nextUrl.pathname.startsWith("/api/report");

      if (isApiAuth || isPublicReport || isApiReport) return true;
      if (!isLoggedIn && !isAuthPage) return false; // redirect to /login
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
};
