import type { Lead } from "@prisma/client";
import { SignJWT } from "jose";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import { createSrLead } from "@/src/lib/ghl-custom-object";
import { getZoneForZip } from "@/src/lib/service-zones";

export interface LeadHandlerArgs {
  lead: Lead;
  ghlContactId: string;
  name: string;
  zip: string;
  tier: "primary" | "secondary" | "out_of_area";
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName.trim();
}

async function signQualifyToken(
  lead: Lead,
  ghlContactId: string,
  zip: string,
  tier: string,
  ttlHours: number
): Promise<{ token: string; exp: Date }> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const exp = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const token = await new SignJWT({
    leadId: lead.id,
    ghlContactId,
    zip,
    tier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(secret);
  return { token, exp };
}

export async function handleTier1Lead(args: LeadHandlerArgs): Promise<void> {
  const { lead, ghlContactId, name, zip } = args;
  try {
    const { token, exp } = await signQualifyToken(lead, ghlContactId, zip, "primary", 48);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { qualifyToken: token, qualifyTokenExp: exp },
    });

    const qualifyUrl = `${process.env.NEXT_PUBLIC_MARKETING_URL}/qualify?token=${encodeURIComponent(token)}`;
    const fn = firstName(name);

    const message =
      `Hey ${fn}! 👋 Thanks for reaching out to Qntum Roofing.\n` +
      `We service your area and would love to get you a free professional roof inspection.\n` +
      `Click the link below to answer a few quick questions and get on our schedule — takes about 2 minutes:\n` +
      `${qualifyUrl}\n` +
      `Reply STOP to opt out.`;

    await sendGhlSms(ghlContactId, message);
    await addGhlTag(ghlContactId, "tier_1", "sr_fb_new");
    await createSrLead(ghlContactId, lead.id, {
      sr_lead_id:        lead.id,
      sr_tier:           "primary",
      sr_zone:           getZoneForZip(zip) ?? "unknown",
      sr_status:         "NEW",
      sr_qualify_status: "pending",
      sr_bot_stage:      "qualifying",
      sr_source:         "facebook-inspection",
      sr_opted_out:      false,
    });
  } catch (err) {
    console.error("[handleTier1Lead] error:", err);
  }
}

export async function handleTier2Lead(args: LeadHandlerArgs): Promise<void> {
  const { lead, ghlContactId, name, zip } = args;
  try {
    const fn = firstName(name);

    const message =
      `Hey ${fn}! Thanks for reaching out to Qntum Roofing.\n` +
      `We're actively expanding into your area and want to make sure we can give you the service you deserve.\n` +
      `Someone from our team will reach out within 24 hours to confirm availability and get your inspection scheduled.\n` +
      `Reply STOP to opt out.`;

    await sendGhlSms(ghlContactId, message);
    await addGhlTag(ghlContactId, "tier_2");
    await createSrLead(ghlContactId, lead.id, {
      sr_lead_id:        lead.id,
      sr_tier:           "secondary",
      sr_zone:           getZoneForZip(zip) ?? "unknown",
      sr_status:         "NEW",
      sr_qualify_status: "pending",
      sr_bot_stage:      "silent",
      sr_source:         "facebook-inspection",
      sr_opted_out:      false,
    });
  } catch (err) {
    console.error("[handleTier2Lead] error:", err);
  }
}

export async function handleOutOfAreaLead(args: LeadHandlerArgs): Promise<void> {
  const { lead, ghlContactId, name, zip } = args;
  try {
    const fn = firstName(name);

    const message =
      `Hey ${fn}! Thanks for reaching out to Qntum Roofing.\n` +
      `Unfortunately we don't service your area just yet — but we're growing fast and plan to expand soon.\n` +
      `We'll hold onto your info and reach out as soon as we're in your neighborhood.\n` +
      `Reply STOP to opt out.`;

    await sendGhlSms(ghlContactId, message);
    await addGhlTag(ghlContactId, "out_of_area");
    await createSrLead(ghlContactId, lead.id, {
      sr_lead_id:        lead.id,
      sr_tier:           "out_of_area",
      sr_zone:           "unknown",
      sr_status:         "NEW",
      sr_qualify_status: "pending",
      sr_bot_stage:      "silent",
      sr_source:         "facebook-inspection",
      sr_opted_out:      false,
    });
  } catch (err) {
    console.error("[handleOutOfAreaLead] error:", err);
  }
}
