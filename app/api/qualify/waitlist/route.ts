import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { upsertGhlContact } from "@/src/lib/ghl-contacts";
import { createSrLead } from "@/src/lib/ghl-custom-object";
import { addGhlTag } from "@/src/lib/ghl-sms";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";
import { isPlausibleEmail } from "@/src/lib/spam-filter";

export async function POST(request: NextRequest) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(request), "qualify:waitlist", 5, 600);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { name: rawName, email: rawEmail, zip: rawZip } = body as { name?: string; email?: string; zip?: string };
  const name = (rawName ?? "").trim();
  const email = (rawEmail ?? "").trim();
  const zip = (rawZip ?? "").trim();

  // Name and email are the point of a waitlist signup; zip is supplementary
  // (the lead is already out_of_area). Do not reject a real signup over a missing
  // zip. Log which fields were missing so genuine failures are distinguishable
  // from bot noise. Field names only, never the values (PII).
  if (!name || !email) {
    const missing = [!name && "name", !email && "email"].filter(Boolean);
    console.warn("[qualify/waitlist] 400 missing fields:", missing.join(", "));
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }
  if (!isPlausibleEmail(email)) {
    console.warn("[qualify/waitlist] 400 invalid email format");
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
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
