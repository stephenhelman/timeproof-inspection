import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { validatePassword } from "@/src/lib/password";
import { wasRecentlyVerified } from "@/src/lib/send-code";
import { untrustAllDevices } from "@/src/lib/device";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email, password, confirmPassword } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isWorkEmail(email)) {
    return NextResponse.json(
      { error: "Only @qntumroofing.com email addresses are allowed" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const verified = await wasRecentlyVerified(normalizedEmail, "forgot-password");
  if (!verified) {
    return NextResponse.json(
      { error: "Verification not completed — please verify your email first" },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
      { status: 400 }
    );
  }

  const { valid, errors } = validatePassword(password ?? "");
  if (!valid) {
    return NextResponse.json(
      { error: "Password does not meet requirements", errors },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Revoke all trusted devices after password reset
  await untrustAllDevices(user.id);

  await prisma.registrationCode.deleteMany({
    where: { email: normalizedEmail, purpose: "forgot-password" },
  });

  return NextResponse.json({ success: true });
}
