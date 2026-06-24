import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { verifyCode } from "@/src/lib/send-code";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";

export async function PATCH(req: Request) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "user:email-verify", 5);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, code } = body;

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  if (!isWorkEmail(email)) {
    return NextResponse.json(
      { error: "Only @qntum.com email addresses are allowed" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const result = await verifyCode(normalizedEmail, code, "email-change");
  if (!result.success) {
    const status = result.error?.includes("Too many") ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Final check that email isn't taken
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json(
      { error: "This email is already in use" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: normalizedEmail, emailVerified: new Date() },
  });

  await prisma.registrationCode.deleteMany({
    where: { email: normalizedEmail, purpose: "email-change" },
  });

  return NextResponse.json({ success: true });
}
