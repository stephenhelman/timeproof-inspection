import NextAuth from "next-auth";
import { authConfig } from "@/src/lib/auth.config";

// Middleware uses ONLY the edge-safe config — no Prisma, no adapter.
// Session is checked via JWT; the authorized() callback in authConfig handles routing.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.gif).*)"],
};
