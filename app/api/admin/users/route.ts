import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canManageUsers, canAccessAdmin } from "@/src/lib/permissions";
import bcrypt from "bcryptjs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canAccessAdmin(user.role)) return forbidden();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      managerId: true,
      manager: { select: { id: true, name: true, email: true } },
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canManageUsers(user.role)) return forbidden("Only admins can create users");

  const body = await req.json().catch(() => ({}));
  const { name, email, role, managerId, password } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

  const newUser = await prisma.user.create({
    data: {
      name: name || null,
      email,
      role,
      managerId: managerId || null,
      password: hashedPassword,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      managerId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(newUser, { status: 201 });
}
