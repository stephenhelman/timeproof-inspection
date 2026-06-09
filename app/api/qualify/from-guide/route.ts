// ── GUIDE → QUALIFY BRIDGE ───────────────────────────────────────────────────
// The roof-guide "Schedule My Free Inspection" CTA hits this route. It mints a
// FRESH qualify token (so the short QUALIFY_TOKEN_EXPIRY_MINUTES window never
// trips no matter how long the guide sat open) and redirects into /qualify.
// Public route (middleware allows /api/qualify/*).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/src/lib/prisma";
import { getZipTier } from "@/src/lib/service-zones";

// Must stay byte-identical to /api/qualify/zip so the qualify page contract is
// unchanged.
const CONSENT_TEXT =
  "By providing your phone number, you consent to receive text messages from Qntum Roofing regarding your inspection request. Message and data rates may apply. Reply STOP at any time to opt out.";

export async function GET(request: NextRequest) {
  const leadId = request.nextUrl.searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.redirect(new URL("/roof-guide?expired=true", request.url));
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  // Guide intake stores the gate-form ZIP on `zip`, not `sourceZip` (sourceZip is
  // only set by the inspection/facebook paths). Prefer sourceZip if a rep has set
  // it, otherwise fall back to the guide form's zip.
  const zip = lead?.sourceZip?.trim() || lead?.zip?.trim() || "";

  if (!lead || !zip) {
    return NextResponse.redirect(new URL("/roof-guide?expired=true", request.url));
  }

  const tier = getZipTier(zip);

  if (tier !== "primary") {
    return NextResponse.redirect(new URL("/roof-guide?out_of_area=true", request.url));
  }

  const expiryMinutes = parseInt(process.env.QUALIFY_TOKEN_EXPIRY_MINUTES ?? "15", 10);
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const token = await new SignJWT({ zip, tier, consentText: CONSENT_TEXT })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secret);

  return NextResponse.redirect(
    new URL(`/qualify?token=${encodeURIComponent(token)}`, request.url),
  );
}
