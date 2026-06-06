import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import { updateSrLead } from "@/src/lib/ghl-custom-object";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      customerName: true,
      phone: true,
      ghlContactId: true,
      assignedUserId: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const repId: string = (body.repId as string) || user.id;

  const repUser = await prisma.user.findUnique({
    where: { id: repId },
    select: { name: true },
  });
  const repName = repUser?.name ?? user.email ?? "your rep";

  // 1. Silence the bot
  await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
    console.error("[lead/claim] updateSrLead failed:", err),
  );

  // 2. Assign rep on lead
  await prisma.lead.update({
    where: { id: lead.id },
    data: { assignedUserId: repId },
  });

  // 3. Fire handoff SMS from bot number
  if (lead.ghlContactId && lead.customerName) {
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    const msg = `Hey ${firstName}, looks like you connected with ${repName}! You're in great hands. It was great talking with you — ${repName} will take it from here!`;
    await sendGhlSms(lead.ghlContactId, msg).catch((err) =>
      console.error("[lead/claim] handoff SMS failed:", err),
    );
  }

  return NextResponse.json({ ok: true, assignedUserId: repId });
}
