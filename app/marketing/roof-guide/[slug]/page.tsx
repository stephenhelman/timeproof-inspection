import { jwtVerify, SignJWT } from "jose";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { leadToGuidePayload, type GuideJWTPayload } from "@/src/lib/guide-pdf";
import GuideClient, { type PersonalizationConfig } from "./GuideClient";

function buildPersonalizationConfig(payload: GuideJWTPayload): PersonalizationConfig {
  const issues = payload.issuesNoticed ?? [];
  const roofAge = payload.roofAge ?? "";

  const hasWaterStains = issues.some(
    (i) => i.toLowerCase().includes("water stain") || i.toLowerCase().includes("ceiling")
  );
  const hasGranules = issues.some((i) => i.toLowerCase().includes("granule"));
  const hasMissingShingles = issues.some(
    (i) => i.toLowerCase().includes("missing") || i.toLowerCase().includes("cracked")
  );
  const hasPonding = issues.some((i) => i.toLowerCase().includes("ponding"));
  const hasSagging = issues.some((i) => i.toLowerCase().includes("sagging"));
  const isOldRoof = roofAge === "20+ yrs" || roofAge === "15–20 yrs";
  const hasNoIssues = issues.includes("None of the above") || issues.length === 0;

  return {
    leadWithTimeline: hasWaterStains || isOldRoof,
    highlightAttic: hasWaterStains || hasSagging,
    highlightFlashing: hasWaterStains,
    highlightGranules: hasGranules,
    highlightRidgeCap: isOldRoof,
    urgencyBanner: hasWaterStains || hasSagging || isOldRoof,

    zoneCallouts: {
      flashing: hasWaterStains
        ? "You mentioned water stains — flashing is one of the most common entry points. This is worth a close look."
        : null,
      atticVentilation: isOldRoof
        ? "With a roof your age, ventilation failure is one of the first things we check. It accelerates every other problem."
        : null,
      ridgeCap: isOldRoof
        ? "The ridge cap takes the highest heat on your entire roof. On older roofs it's often the first zone to fail."
        : null,
      deckingUnderside: hasWaterStains
        ? "Water stains inside mean moisture has already reached the decking. This is exactly what we look for in the attic."
        : null,
      fieldShingles: hasGranules
        ? "Granules in your gutters are the first visible sign your shingles are aging out. Worth knowing how far along it is."
        : null,
    },

    banner: hasNoIssues
      ? null
      : hasWaterStains
      ? {
          type: "warning",
          text: "Based on what you reported, you may already have active moisture in your roof assembly. The sections below explain what that means.",
        }
      : isOldRoof
      ? {
          type: "info",
          text: "A roof your age in El Paso is past the point where most problems become invisible from the street. The timeline below shows why.",
        }
      : {
          type: "info",
          text: "Even without visible symptoms, El Paso's climate is actively working on your roof. Here's what to know.",
        },

    hasMissingShingles,
    hasPonding,
    hasSagging,
    hasWaterStains,
    hasGranules,
    isOldRoof,
  };
}

export default async function GuideSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const lead = await prisma.lead.findUnique({ where: { guideSlug: slug } });
  if (!lead?.guideToken) {
    redirect("/roof-guide?expired=true");
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  // Verify the stored token for access only. Its payload may be the old fat shape
  // or the new slim { leadId } — we don't read fields from it; everything is
  // re-derived from the lead record below.
  try {
    await jwtVerify(lead.guideToken, secret);
  } catch {
    redirect("/roof-guide?expired=true");
  }

  // Self-heal: mint a fresh slim token so the PDF download link carries the small
  // payload even for leads created before the slimming (no DB migration needed).
  const slimToken = await new SignJWT({ leadId: lead.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);

  const payload: GuideJWTPayload = leadToGuidePayload(lead);
  const config = buildPersonalizationConfig(payload);

  return (
    <GuideClient
      firstName={payload.firstName}
      roofType={payload.roofType}
      roofAge={payload.roofAge}
      issuesNoticed={payload.issuesNoticed}
      config={config}
      token={slimToken}
    />
  );
}
