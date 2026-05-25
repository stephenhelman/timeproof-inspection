import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import GuideClient, { type PersonalizationConfig } from "./GuideClient";

interface GuideJWTPayload {
  leadId: string;
  roofType: string;
  roofAge: string;
  issuesNoticed: string[];
  firstName: string;
}

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
  const hasNoIssues =
    issues.includes("None of the above") || issues.length === 0;

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

    // Derived flags used by client to filter sections
    hasMissingShingles,
    hasPonding,
    hasSagging,
    hasWaterStains,
    hasGranules,
    isOldRoof,
  };
}

export default async function GuideTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  let payload: GuideJWTPayload;
  try {
    const { payload: p } = await jwtVerify(token, secret);
    payload = p as unknown as GuideJWTPayload;
  } catch {
    redirect("/roof-guide?expired=true");
  }

  const config = buildPersonalizationConfig(payload);

  return (
    <GuideClient
      firstName={payload.firstName}
      roofType={payload.roofType}
      roofAge={payload.roofAge}
      issuesNoticed={payload.issuesNoticed}
      config={config}
      token={token}
    />
  );
}
