import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/src/lib/prisma";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ghl-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await request.json().catch(() => null);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 200 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 200 });
  }

  const { leadId, ghlContactId } = body as Record<string, unknown>;

  if (!leadId || typeof leadId !== "string" || !ghlContactId || typeof ghlContactId !== "string") {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 200 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  }

  if (lead.ghlContactId !== ghlContactId) {
    return NextResponse.json({ error: "contact_mismatch" }, { status: 403 });
  }

  if (lead.status !== "NEW") {
    return NextResponse.json({ alreadyQualified: true }, { status: 200 });
  }

  const ttlHours = 48;
  const jwtSecret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const exp = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const token = await new SignJWT({
    leadId: lead.id,
    ghlContactId,
    zip: lead.zip,
    tier: lead.sourceTier ?? "primary",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(jwtSecret);

  await prisma.lead.update({
    where: { id: lead.id },
    data: { qualifyToken: token, qualifyTokenExp: exp },
  });

  const qualifyUrl = `${process.env.NEXT_PUBLIC_MARKETING_URL}/qualify?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ token, qualifyUrl });
}
