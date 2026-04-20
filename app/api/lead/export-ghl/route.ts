import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { exportLead } from "@/src/lib/ghl-service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { leadIds } = body as { leadIds?: unknown };

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds as string[] } },
  });

  let exported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const ghlContactId = await exportLead(lead);
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ghlContactId },
      });
      exported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GHL export] lead ${lead.id} failed:`, msg);
      errors.push(`${lead.customerName}: ${msg}`);
      failed++;
    }
  }

  return NextResponse.json({ exported, failed, errors });
}
