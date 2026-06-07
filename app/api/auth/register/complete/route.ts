import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { validatePassword } from "@/src/lib/password";
import { wasRecentlyVerified } from "@/src/lib/send-code";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";

export async function POST(req: Request) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "auth:register-complete", 10);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, confirmPassword, name } = body;

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

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 400 }
    );
  }

  const verified = await wasRecentlyVerified(normalizedEmail, "registration");
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

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  await prisma.registrationCode.deleteMany({
    where: { email: normalizedEmail },
  });

  return NextResponse.json({ success: true, userId: user.id });
}
