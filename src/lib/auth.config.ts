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

      // Not logged in — only allow the login page
      if (!isLoggedIn) {
        return pathname.startsWith("/login") ? true : false;
      }

      // Fully authenticated — redirect away from the login page
      if (pathname.startsWith("/login")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
};
