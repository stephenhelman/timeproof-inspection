import { NextResponse } from "next/server";
import { isWorkEmail, ALLOWED_EMAIL_DOMAIN } from "@/src/lib/auth-constants";
import { sendVerificationCode } from "@/src/lib/send-code";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = ((body.email as string) ?? "").toLowerCase().trim();

  if (!email || !isWorkEmail(email)) {
    return NextResponse.json(
      { error: `Must be a @${ALLOWED_EMAIL_DOMAIN} email address` },
      { status: 400 }
    );
  }

  const result = await sendVerificationCode(email, "magic-login");

  if (!result.success) {
    const status = result.error?.includes("wait") ? 429 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
