import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";

const SYSTEM_PROMPT = `You are a professional roofing inspector's AI assistant helping to generate a homeowner-facing roof diagnosis. Your role is to produce a personalized, evidence-based analysis that guides the homeowner to understand their own roof's condition — without declaring conclusions for them.

Rules:
1. Use the homeowner's OWN words from intake when referencing what they've noticed or worried about.
2. Reference the specific warning signs they acknowledged as already knowing about.
3. Structure findings zone by zone using the photo data provided.
4. Ask open-ended, leading questions instead of declaring findings. Example: "You mentioned noticing granules in your gutters — given what we found at the ridge cap, does that timeline make sense to you?"
5. Never diagnose definitively. Guide the homeowner to connect the dots themselves.
6. Keep language clear, non-technical, and empathetic.
7. End with a forward-looking question: "Based on everything you've seen today, what do you think the root issue might be?"

You must produce two outputs separated by the marker ---JSON---:

First: A human-readable diagnosis (2-5 paragraphs). Zone-by-zone, question-driven, references homeowner's own words.

Then the marker: ---JSON---

Then: A JSON object (no markdown, no code fences) with this exact shape:
{
  "zones": [
    {
      "zone": "string — zone name from photo data",
      "findingType": "string — e.g. granule_loss, moisture_intrusion, ventilation_failure",
      "severity": "high | medium | low",
      "confidence": 0.0-1.0,
      "referencedWarningSign": "string | null — warning sign id if applicable"
    }
  ],
  "overallSeverity": "high | medium | low",
  "primaryConcern": "string — main finding type",
  "homeownerAdmissions": ["string array — direct quotes or paraphrases from intake and warning signs"]
}`;

interface PhotoInput {
  zone: string | null;
  damageTags: string[];
  description: string | null;
  photoSection: string;
}

function buildUserMessage(
  photos: PhotoInput[],
  intakeData: Record<string, unknown>,
  warningSignsCovered: string[],
): string {
  const photoLines = photos.map((p, i) => {
    const tags = p.damageTags.length > 0 ? p.damageTags.join(", ") : "no tags";
    const zone = p.zone ?? "unspecified";
    const note = p.description ? ` — Rep note: "${p.description}"` : "";
    return `Photo ${i + 1} [${p.photoSection}] Zone: ${zone} | Tags: ${tags}${note}`;
  });

  const intakeLines: string[] = [];
  const intakeFields: Array<[string, string]> = [
    ["northStar", "Why are we here (North Star)"],
    ["focusDrivers", "What moves the needle"],
    ["issuesConcerns", "Issues & concerns"],
    ["issueDuration", "How long"],
    ["issueImpact", "Impact"],
    ["rootCauseBeliefBefore", "Their root cause belief (before)"],
    ["triggerMoment", "Trigger moment"],
    ["problemAwarenessBefore", "Problem awareness (before)"],
  ];

  for (const [key, label] of intakeFields) {
    const val = intakeData[key];
    if (val && typeof val === "string" && val.trim()) {
      intakeLines.push(`${label}: "${val.trim()}"`);
    }
  }

  // Also check intakePass1 JSON field
  if (intakeData.intakePass1 && typeof intakeData.intakePass1 === "object") {
    const p1 = intakeData.intakePass1 as Record<string, unknown>;
    for (const [key, label] of intakeFields) {
      if (!intakeData[key] && p1[key] && typeof p1[key] === "string") {
        intakeLines.push(`${label}: "${(p1[key] as string).trim()}"`);
      }
    }
  }

  return [
    "=== PHOTO EVIDENCE ===",
    photoLines.length > 0 ? photoLines.join("\n") : "No photos uploaded.",
    "",
    "=== HOMEOWNER INTAKE (PRE-DIAGNOSIS) ===",
    intakeLines.length > 0 ? intakeLines.join("\n") : "No intake data recorded.",
    "",
    "=== WARNING SIGNS ACKNOWLEDGED ===",
    warningSignsCovered.length > 0
      ? warningSignsCovered.join(", ")
      : "None acknowledged.",
  ].join("\n");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { photos: { orderBy: { photoNumber: "asc" } } },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await prisma.inspection.update({
      where: { id },
      data: {
        aiDiagnosisDescription:
          "AI diagnosis unavailable — API not configured. Enter findings manually below.",
        aiGeneratedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: "AI diagnosis is not configured — ANTHROPIC_API_KEY missing" },
      { status: 503 },
    );
  }

  const userMessage = buildUserMessage(
    inspection.photos.map((p) => ({
      zone: p.zone,
      damageTags: p.damageTags,
      description: p.description,
      photoSection: p.photoSection,
    })),
    inspection as unknown as Record<string, unknown>,
    inspection.warningSignsCovered,
  );

  let rawText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[diagnose] Claude API error:", res.status, body);
      await prisma.inspection.update({
        where: { id },
        data: {
          aiDiagnosisDescription:
            "AI diagnosis unavailable — API error. Enter findings manually below.",
          aiGeneratedAt: new Date(),
        },
      });
      return NextResponse.json(
        { error: "AI diagnosis failed — Claude API error" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { content: { text: string }[] };
    rawText = data.content[0]?.text ?? "";
  } catch (err) {
    console.error("[diagnose] fetch error:", err);
    await prisma.inspection.update({
      where: { id },
      data: {
        aiDiagnosisDescription:
          "AI diagnosis unavailable — network error. Enter findings manually below.",
        aiGeneratedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: "AI diagnosis failed — network error" },
      { status: 502 },
    );
  }

  // Parse the two sections
  const marker = "---JSON---";
  const markerIdx = rawText.indexOf(marker);

  let aiDiagnosisDescription = rawText.trim();
  let aiDiagnosisStructured: unknown = null;

  if (markerIdx !== -1) {
    aiDiagnosisDescription = rawText.slice(0, markerIdx).trim();
    const jsonPart = rawText.slice(markerIdx + marker.length).trim();
    try {
      aiDiagnosisStructured = JSON.parse(jsonPart);
    } catch {
      console.warn("[diagnose] Failed to parse structured JSON — storing raw text");
      aiDiagnosisStructured = { raw: jsonPart };
    }
  }

  await prisma.inspection.update({
    where: { id },
    data: {
      aiDiagnosisDescription,
      aiDiagnosisStructured: aiDiagnosisStructured as never,
      aiGeneratedAt: new Date(),
    },
  });

  return NextResponse.json({
    aiDiagnosisDescription,
    aiDiagnosisStructured,
    aiGeneratedAt: new Date().toISOString(),
  });
}
