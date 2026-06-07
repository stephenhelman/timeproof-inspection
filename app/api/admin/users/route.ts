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
      staffOnly: true,
      phone: true,
      area: true,
      ghlUserId: true,
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
  const { name, email, role, managerId, password, staffOnly, phone, area, ghlUserId } = body;

  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  if (staffOnly) {
    // Staff users: name required, auto-generated placeholder email, no password
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required for staff users" }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const placeholderEmail = `staff-${slug}-${Date.now()}@staff.internal`;

    const newStaffUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: placeholderEmail,
        role,
        staffOnly: true,
        isActive: true,
        phone: phone?.trim() || null,
        area: area?.trim() || null,
        ghlUserId: ghlUserId?.trim() || null,
        managerId: managerId || null,
        password: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        staffOnly: true,
        phone: true,
        area: true,
        ghlUserId: true,
        managerId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newStaffUser, { status: 201 });
  }

  // Regular user
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
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
      staffOnly: true,
      managerId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(newUser, { status: 201 });
}
