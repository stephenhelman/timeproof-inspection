import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { upsertGhlContact } from "@/src/lib/ghl-contacts";
import { createSrLead } from "@/src/lib/ghl-custom-object";
import { addGhlTag } from "@/src/lib/ghl-sms";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, email, zip } = body as { name?: string; email?: string; zip?: string };

  if (!name || !email || !zip) {
    return NextResponse.json({ error: "name, email, and zip are required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      customerName:  name,
      email,
      streetAddress: "",
      city:          "",
      state:         "",
      zip,
      sourceZip:     zip,
      sourceTier:    "out_of_area",
      source:        "facebook_waitlist",
      status:        "OUT_OF_AREA",
    },
  });

  try {
    const nameParts   = name.trim().split(" ");
    const firstName   = nameParts[0] ?? name;
    const lastName    = nameParts.slice(1).join(" ");

    const { ghlContactId } = await upsertGhlContact({
      firstName,
      lastName,
      email,
      srSource:   "organic-inspection",
      srBotStage: "silent",
      leadId:     lead.id,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data:  { ghlContactId },
    });

    await createSrLead(ghlContactId, lead.id, {
      sr_lead_id:        lead.id,
      sr_tier:           "out_of_area",
      sr_zone:           "unknown",
      sr_status:         "NEW",
      sr_qualify_status: "pending",
      sr_bot_stage:      "silent",
      sr_source:         "organic-inspection",
      sr_opted_out:      false,
    });

    // No opportunity — out-of-area leads do not enter the pipeline
    await addGhlTag(ghlContactId, "out_of_area")
      .catch(err => console.error("[qualify/waitlist] addGhlTag out_of_area failed:", err));
  } catch (err) {
    console.error("[qualify/waitlist] GHL sync failed:", err);
  }

  return NextResponse.json({ success: true, lead_id: lead.id });
}
