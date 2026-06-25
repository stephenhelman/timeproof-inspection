import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canEditInspection } from "@/src/lib/permissions";

// ── Two-call generation ──────────────────────────────────────────────────────
// Call A — STRUCTURED CLINICAL DATA (for the rep copy + Jordan). Exhaustive,
//   machine-readable. JSON/tool mode (NOT a string-split). Density is fine here.
// Call B — HOMEOWNER WALKTHROUGH (NEPQ, guided). Fed Call A's findings. Produces
//   1-2 paced steps (observation → leading question) the homeowner answers in
//   their own words on the report. Never declares the conclusion.
// The brittle `---JSON---` marker split is gone; each call returns a typed tool
// input we read directly.

const STRUCTURED_SYSTEM_PROMPT = `You are a roofing inspector's analysis engine. From the photo evidence, the homeowner's intake answers, and the warning signs they acknowledged, produce a complete clinical diagnosis as structured data.

This output is INTERNAL — it goes to the rep and to the follow-up system, never to the homeowner. So be exhaustive and precise, not conversational.

Rules:
1. Cover every zone the photo data supports — one entry per distinct finding.
2. severity: high = active or imminent failure, medium = degradation in progress, low = early/cosmetic.
3. confidence: 0.0-1.0, how strongly the photo evidence supports the finding. Be honest; do not inflate.
4. findingType: a short snake_case label, e.g. granule_loss, moisture_intrusion, ventilation_failure, flashing_failure, decking_rot.
5. referencedWarningSign: the warning-sign id this finding maps to, or null.
6. primaryConcern: the single findingType that most threatens the home.
7. homeownerAdmissions: direct quotes or close paraphrases of what the homeowner said in intake or acknowledged in warning signs — their actual words, not clinical restatements.

Call the record_diagnosis tool with the complete structured diagnosis.`;

const WALKTHROUGH_SYSTEM_PROMPT = `You are helping a roofing inspector build a GUIDED walkthrough that lets the homeowner realize their roof's condition ON THEIR OWN. This is NEPQ: you do not tell them what's wrong — you show them what you saw and ask one question that makes the gap obvious, so they say it first.

You are given the clinical findings (already diagnosed) plus the homeowner's own words from intake. Your job is to turn the 1-2 MOST SERIOUS findings into a short, paced sequence the homeowner walks through.

THE CORE RULE — never declare the conclusion. Lead with a question; let the homeowner reach it and type it in their own words. Wrong: "Your ventilation has failed and it's cooking the decking." Right: "We measured the attic at 130 degrees with the soffit vents blocked. You mentioned your upstairs 'never gets cool in summer no matter what we set it to.' Where do you think that heat is going?"

Rules:
1. Choose only the 1-2 HIGHEST-SEVERITY findings. Focus is the point — do not walk them through everything. The rest lives in the clinical record.
2. Each step has an OBSERVATION and ONE QUESTION.
   - observation: 2-3 short sentences. What we saw at that zone, tied to the photo, and tied to the homeowner's OWN WORDS from intake when they connect. Use their exact phrasing in quotes. Plain, factual, no verdict.
   - question: ONE open, leading question that makes them connect the dots and say the problem themselves. Not yes/no. Not two questions. Short questions hit harder.
3. findingRef: the zone/finding this step covers. photoRef: the zone name whose photo should appear with this step (match the zone names you were given), or null.
4. Order steps worst-first.
5. closingQuestion: always end the whole sequence with a forward-looking question that asks the homeowner to name the root issue themselves. Default: "Based on everything you've seen today, what do you think the root issue might be?"

WRITING STYLE — follow without exception:
- Talk the way a person talks, not the way a report reads. Contractions. Address them as "you".
- Vary sentence length. Short sentences land. Never three same-length sentences in a row.
- No em dashes. No semicolons. Zero exclamation points.
- Plain English. No filler ("it's important to note", "as you can see"). No AI tells ("delve", "robust", "comprehensive", "leverage", "utilize").
- Use the homeowner's exact words in quotes — never paraphrase their language into clinical terms. Write "seeing shingles in the yard after every storm", not "recurrent shingle displacement".
- Never use a severity score, a confidence number, or a clinical finding-type label in the observation or question. That language is for the rep, not the homeowner.

Call the record_walkthrough tool with the sequence.`;

const DIAGNOSIS_TOOL = {
  name: "record_diagnosis",
  description: "Record the complete structured clinical diagnosis.",
  input_schema: {
    type: "object",
    properties: {
      zones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            zone: { type: "string", description: "Zone name from the photo data" },
            findingType: { type: "string", description: "snake_case finding label" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            confidence: { type: "number", description: "0.0-1.0" },
            referencedWarningSign: {
              type: ["string", "null"],
              description: "warning sign id, or null",
            },
          },
          required: ["zone", "findingType", "severity", "confidence", "referencedWarningSign"],
        },
      },
      overallSeverity: { type: "string", enum: ["high", "medium", "low"] },
      primaryConcern: { type: "string", description: "main findingType" },
      homeownerAdmissions: {
        type: "array",
        items: { type: "string" },
        description: "Direct quotes/paraphrases from intake + warning signs",
      },
    },
    required: ["zones", "overallSeverity", "primaryConcern", "homeownerAdmissions"],
  },
} as const;

const WALKTHROUGH_TOOL = {
  name: "record_walkthrough",
  description: "Record the homeowner's guided NEPQ walkthrough (1-2 steps + closing question).",
  input_schema: {
    type: "object",
    properties: {
      walkthroughSteps: {
        type: "array",
        description: "1-2 steps only — the highest-severity findings.",
        items: {
          type: "object",
          properties: {
            findingRef: { type: "string", description: "zone/finding this step covers" },
            observation: {
              type: "string",
              description: "2-3 short sentences tied to the photo + the homeowner's own words. No verdict.",
            },
            question: {
              type: "string",
              description: "ONE open, leading NEPQ question. No clinical language.",
            },
            photoRef: {
              type: ["string", "null"],
              description: "zone name whose photo to show, or null",
            },
          },
          required: ["findingRef", "observation", "question", "photoRef"],
        },
      },
      closingQuestion: {
        type: "string",
        description: "Forward-looking question asking the homeowner to name the root issue.",
      },
    },
    required: ["walkthroughSteps", "closingQuestion"],
  },
} as const;

interface PhotoInput {
  zone: string | null;
  damageTags: string[];
  description: string | null;
  photoSection: string;
}

function buildEvidenceMessage(
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

interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: unknown;
}

// One forced-tool Claude call. Returns the tool input object, or throws.
async function callClaudeTool(
  apiKey: string,
  system: string,
  userMessage: string,
  tool: ClaudeToolDef,
): Promise<Record<string, unknown>> {
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
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[diagnose] Claude API error:", res.status, body);
    throw new Error(`Claude API error ${res.status}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
  };
  const toolUse = data.content.find((b) => b.type === "tool_use" && b.name === tool.name);
  if (!toolUse?.input) {
    throw new Error("Claude returned no tool_use block");
  }
  return toolUse.input;
}

// Flat, human-readable fallback derived from the walkthrough — kept for any
// legacy reader of aiDiagnosisDescription. The homeowner render uses the
// structured walkthrough, not this.
function deriveDescription(
  steps: Array<{ findingRef?: string; observation?: string }>,
): string {
  return steps
    .map((s) => {
      const head = s.findingRef ? `**${s.findingRef}**\n\n` : "";
      return `${head}${s.observation ?? ""}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
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
  if (!canEditInspection(user.id, user.role, inspection)) return forbidden();

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

  const evidence = buildEvidenceMessage(
    inspection.photos.map((p) => ({
      zone: p.zone,
      damageTags: p.damageTags,
      description: p.description,
      photoSection: p.photoSection,
    })),
    inspection as unknown as Record<string, unknown>,
    inspection.warningSignsCovered,
  );

  // Zones available for the walkthrough's photoRef matching.
  const availableZones = Array.from(
    new Set(
      inspection.photos
        .map((p) => p.zone)
        .filter((z): z is string => !!z && z.trim().length > 0),
    ),
  );

  try {
    // Call A — clinical structured data (rep + Jordan).
    const structured = await callClaudeTool(
      apiKey,
      STRUCTURED_SYSTEM_PROMPT,
      evidence,
      DIAGNOSIS_TOOL,
    );

    // Call B — homeowner NEPQ walkthrough, fed Call A's findings.
    const walkthroughMessage = [
      evidence,
      "",
      "=== CLINICAL FINDINGS (already diagnosed — internal, do not repeat verbatim to the homeowner) ===",
      JSON.stringify(structured, null, 2),
      "",
      "=== ZONE NAMES AVAILABLE FOR photoRef ===",
      availableZones.length > 0 ? availableZones.join(", ") : "none",
    ].join("\n");

    const walkthrough = await callClaudeTool(
      apiKey,
      WALKTHROUGH_SYSTEM_PROMPT,
      walkthroughMessage,
      WALKTHROUGH_TOOL,
    );

    const steps = Array.isArray(walkthrough.walkthroughSteps)
      ? (walkthrough.walkthroughSteps as Array<{ findingRef?: string; observation?: string }>)
      : [];

    await prisma.inspection.update({
      where: { id },
      data: {
        aiDiagnosisStructured: structured as never,
        aiDiagnosisWalkthrough: walkthrough as never,
        aiDiagnosisDescription: deriveDescription(steps),
        aiGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({
      aiDiagnosisStructured: structured,
      aiDiagnosisWalkthrough: walkthrough,
      aiGeneratedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[diagnose] generation error:", err);
    await prisma.inspection.update({
      where: { id },
      data: {
        aiDiagnosisDescription:
          "AI diagnosis unavailable — generation error. Enter findings manually below.",
        aiGeneratedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: "AI diagnosis failed — generation error" },
      { status: 502 },
    );
  }
}
