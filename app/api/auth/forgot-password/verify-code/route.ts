import { NextResponse } from "next/server";
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

  const normalizedEmail = email.toLowerCase().trim();
  const result = await verifyCode(normalizedEmail, code, "forgot-password");

  if (!result.success) {
    const status = result.error?.includes("Too many") ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
