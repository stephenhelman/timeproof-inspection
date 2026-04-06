import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { validatePassword } from "@/src/lib/password";
import { untrustAllDevices } from "@/src/lib/device";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword, confirmPassword } = body;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.password) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const currentValid = await bcrypt.compare(currentPassword ?? "", user.password);
  if (!currentValid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "New passwords do not match" },
      { status: 400 }
    );
  }

  const { valid, errors } = validatePassword(newPassword ?? "");
  if (!valid) {
    return NextResponse.json(
      { error: "Password does not meet requirements", errors },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Revoke all trusted devices after password change
  await untrustAllDevices(user.id);

  return NextResponse.json({ success: true });
}
