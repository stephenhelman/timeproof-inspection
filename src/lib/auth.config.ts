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

      // Always allow: NextAuth internals, public report, report API, business card,
      // GHL webhooks, and the public marketing gallery feed (served to the ISR
      // gallery page, which fetches it server-side without a session).
      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/summary") ||
        pathname.startsWith("/api/report") ||
        pathname.startsWith("/api/gallery") ||
        pathname.startsWith("/card") ||
        pathname.startsWith("/api/webhooks") ||
        (pathname.startsWith("/api/user/") && pathname.endsWith("/card"))
      ) {
        return true;
      }

      // Not logged in — allow login, register, forgot-password
      if (!isLoggedIn) {
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/forgot-password")
        ) {
          return true;
        }
        return false;
      }

      // Fully authenticated — redirect away from auth pages
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password")
      ) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Admin routes — require REGIONAL or higher
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        const role = (auth?.user as { role?: string } | undefined)?.role;
        const adminRoles = ["ADMIN", "REGIONAL"];
        if (!role || !adminRoles.includes(role)) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      return true;
    },
  },
};
