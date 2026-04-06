import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { sendVerificationCode } from "@/src/lib/send-code";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendVerificationCode(session.user.email, "2fa");
  if (!result.success) {
    const status = result.error?.includes("wait") ? 429 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
