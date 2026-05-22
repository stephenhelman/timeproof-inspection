import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canViewWebhookLogs } from "@/src/lib/permissions";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canViewWebhookLogs(user.role)) return forbidden();

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const status = searchParams.get("status");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10), 200);

  const logs = await prisma.webhookLog.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(logs);
}
