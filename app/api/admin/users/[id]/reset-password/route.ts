import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canResetPassword } from "@/src/lib/permissions";
import { sendVerificationCode } from "@/src/lib/send-code";
import bcrypt from "bcryptjs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canResetPassword(user.role)) return forbidden("Only admins can reset passwords");

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { newPassword, sendEmail } = body;

  if (newPassword) {
    // Direct password set
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    return NextResponse.json({ ok: true, method: "direct" });
  }

  if (sendEmail) {
    // Trigger a password reset email via the existing send-code system
    const result = await sendVerificationCode(target.email, "forgot-password");
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, method: "email" });
  }

  return NextResponse.json({ error: "Provide newPassword or sendEmail: true" }, { status: 400 });
}
