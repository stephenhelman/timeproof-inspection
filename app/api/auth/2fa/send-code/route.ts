import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { sendVerificationCode } from "@/src/lib/send-code";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";

export async function POST(req: Request) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "auth:2fa-send", 10);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
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
