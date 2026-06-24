import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";
import { buildLeadScope } from "@/src/lib/permissions";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone")?.trim();

  if (!phone || phone.length < 7) {
    return NextResponse.json({ found: false });
  }

  // Match on last 10 digits to handle different formatting (+1, dashes, parens)
  const digits = phone.replace(/\D/g, "");
  const suffix = digits.slice(-10);

  // Scope to leads the caller is allowed to see (managers see all; reps/setters
  // only their own). Matches the scoping already applied to the lead list.
  const leads = await prisma.lead.findMany({
    where: { phone: { contains: suffix }, ...buildLeadScope(user.id, user.role) },
    include: {
      assignedUser: { select: { id: true, name: true } },
      srLead: { select: { srBotStage: true } },
      _count: { select: { inspections: true, tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });

  if (!leads.length) {
    return NextResponse.json({ found: false });
  }

  const lead = leads[0];

  let botContextSummary: string | null = null;
  if (lead.ghlContactId) {
    const botThread = await prisma.botThread.findFirst({
      where: { ghlContactId: lead.ghlContactId },
      orderBy: { updatedAt: "desc" },
      select: { metadata: true },
    });
    const meta = botThread?.metadata as Record<string, unknown> | null;
    botContextSummary = (meta?.summary as string) ?? null;
  }

  return NextResponse.json({
    found: true,
    lead: {
      id: lead.id,
      customerName: lead.customerName,
      address: lead.address,
      streetAddress: lead.streetAddress,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      phone: lead.phone,
      status: lead.status,
      ghlContactId: lead.ghlContactId,
      ghlOpportunityId: lead.ghlOpportunityId,
      dispoPrimaryObjection: lead.dispoPrimaryObjection,
      dispoNotes: lead.dispoNotes,
      updatedAt: lead.updatedAt,
      assignedUser: lead.assignedUser,
      srLead: lead.srLead,
      botContextSummary,
      _count: lead._count,
    },
  });
}
