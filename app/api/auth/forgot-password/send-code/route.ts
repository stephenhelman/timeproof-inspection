import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { sendVerificationCode } from "@/src/lib/send-code";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email } = body;

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

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) {
    return NextResponse.json(
      { error: "No account found with this email" },
      { status: 400 }
    );
  }

  const result = await sendVerificationCode(normalizedEmail, "forgot-password");
  if (!result.success) {
    const status = result.error?.includes("wait") ? 429 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
