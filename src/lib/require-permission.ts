import { NextResponse } from "next/server";
import { auth } from "./auth";
import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

// Resolves the current session user or returns null.
// Usage: const user = await getSessionUser(); if (!user) return unauthorized();
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user as
    | { id?: string; email?: string; role?: string }
    | undefined;

  if (!u?.id || !u?.email || !u?.role) return null;

  return {
    id: u.id,
    email: u.email,
    role: u.role as UserRole,
  };
}

// Convenience: returns the user or a 401 Response.
// Callers must check via instanceof NextResponse before using the result.
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return user;
}
