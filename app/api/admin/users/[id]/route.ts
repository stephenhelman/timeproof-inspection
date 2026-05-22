import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canManageUsers, canAccessAdmin } from "@/src/lib/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canAccessAdmin(user.role)) return forbidden();

  // Non-admin managers can update limited fields only
  const isFullAdmin = canManageUsers(user.role);

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent demoting or deactivating the last ADMIN
  const body = await req.json().catch(() => ({}));
  const { name, role, isActive, managerId } = body;

  if (!isFullAdmin && (role !== undefined || isActive !== undefined)) {
    return forbidden("Only admins can change roles or deactivate users");
  }

  // Guard: don't let admins remove the last active admin
  if (role && role !== "ADMIN" && target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(managerId !== undefined && { managerId: managerId || null }),
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

  return NextResponse.json(updated);
}
