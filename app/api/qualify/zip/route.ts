import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getZipTier } from "@/src/lib/service-zones";

const CONSENT_TEXT =
  "By providing your phone number, you consent to receive text messages from Qntum Roofing regarding your inspection request. Message and data rates may apply. Reply STOP at any time to opt out.";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { zip, isHomeowner } = body as { zip?: string; isHomeowner?: boolean };

  if (!zip || typeof isHomeowner !== "boolean") {
    return NextResponse.json({ error: "zip and isHomeowner are required" }, { status: 400 });
  }

  if (!isHomeowner) {
    return NextResponse.json({ result: "not-homeowner" });
  }

  const tier = getZipTier(zip.trim());

  // Manual-only ZIPs go to waitlist — they don't enter the primary funnel
  if (tier === "out_of_area" || tier === "secondary") {
    return NextResponse.json({ result: "fail" });
  }

  const expiryMinutes = parseInt(process.env.QUALIFY_TOKEN_EXPIRY_MINUTES ?? "15", 10);

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const token = await new SignJWT({ zip: zip.trim(), tier, consentText: CONSENT_TEXT })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secret);

  return NextResponse.json({ result: "pass", tier, token });
}
