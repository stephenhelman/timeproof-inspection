import { NextResponse } from "next/server";
import { isWorkEmail } from "@/src/lib/auth-constants";
import { verifyCode } from "@/src/lib/send-code";

export async function POST(req: Request) {
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
      { error: "Only @qntumroofing.com email addresses are allowed" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  const result = await verifyCode(normalizedEmail, code, "registration");

  if (!result.success) {
    const status = result.error?.includes("Too many") ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, verifiedEmail: normalizedEmail });
}
