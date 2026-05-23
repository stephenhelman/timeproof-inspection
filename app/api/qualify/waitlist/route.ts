import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

async function fireGhlWebhook(payload: object) {
  const url = process.env.GHL_LEADS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[qualify/waitlist] GHL webhook failed:", err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, email, zip } = body as { name?: string; email?: string; zip?: string };

  if (!name || !email || !zip) {
    return NextResponse.json({ error: "name, email, and zip are required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      customerName: name,
      email,
      streetAddress: "",
      city: "",
      state: "",
      zip,
      sourceZip: zip,
      sourceTier: "out_of_area",
      source: "facebook_waitlist",
      status: "OUT_OF_AREA",
    },
  });

  await fireGhlWebhook({
    event: "lead_out_of_area",
    name,
    email,
    zip,
    captured_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, lead_id: lead.id });
}
