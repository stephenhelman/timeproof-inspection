import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { trustDevice } from "@/src/lib/device";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceToken = await trustDevice(session.user.id);
  return NextResponse.json({ deviceToken });
}
