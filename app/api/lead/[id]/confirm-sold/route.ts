import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { notifyManager } from "@/src/lib/ghl-sms";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.status !== "PENDING_SOLD_CONFIRMATION") {
    return NextResponse.json({ error: "Lead is not in PENDING_SOLD_CONFIRMATION status" }, { status: 409 });
  }

  const confirmedBy = session.user.name ?? session.user.email ?? session.user.id;

  const updated = await prisma.lead.update({
    where: { id: params.id },
    data: {
      status: "SOLD",
      pendingSoldConfirmedBy: confirmedBy,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
  await notifyManager(
    `SOLD CONFIRMED — ${lead.customerName}\n${lead.streetAddress}, ${lead.city}\nConfirmed by: ${confirmedBy}\n${appUrl}/leads/${params.id}`
  ).catch((e) => console.warn("[confirm-sold] notifyManager failed:", e));

  return NextResponse.json(updated);
}
