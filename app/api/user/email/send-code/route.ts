import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { sendVerificationCode } from "@/src/lib/send-code";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isWorkEmail(email)) {
    return NextResponse.json(
      { error: "Only @operationprofitllc.com email addresses are allowed" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check not already taken by another user
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json(
      { error: "This email is already in use" },
      { status: 400 }
    );
  }

  const result = await sendVerificationCode(normalizedEmail, "email-change");
  if (!result.success) {
    const status = result.error?.includes("wait") ? 429 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
