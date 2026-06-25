import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";

// Public route — the homeowner types their own-words answers into the guided
// walkthrough on their report page (no session). Attacker-reachable to anyone
// holding a report UUID, so bound everything it writes.
const MAX_STEPS = 10;
const ANSWER_MAX = 2000;
const REF_MAX = 200;

interface SavedStep {
  stepRef: string;
  answer: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "report:walkthrough", 60, 600);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
    select: { id: true },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { steps, closingAnswer } = body as {
    steps?: unknown;
    closingAnswer?: unknown;
  };

  const safeSteps: SavedStep[] = (Array.isArray(steps) ? steps : [])
    .slice(0, MAX_STEPS)
    .filter(
      (s): s is { stepRef: unknown; answer: unknown } =>
        !!s && typeof s === "object",
    )
    .map((s) => ({
      stepRef: typeof s.stepRef === "string" ? s.stepRef.slice(0, REF_MAX) : "",
      answer: typeof s.answer === "string" ? s.answer.slice(0, ANSWER_MAX) : "",
    }))
    .filter((s) => s.answer.trim().length > 0);

  const safeClosing =
    typeof closingAnswer === "string" ? closingAnswer.slice(0, ANSWER_MAX).trim() : "";

  // Nothing usable — don't overwrite prior answers with an empty payload.
  if (safeSteps.length === 0 && !safeClosing) {
    return NextResponse.json({ ok: true, saved: false });
  }

  await prisma.inspection.update({
    where: { id: inspection.id },
    data: {
      homeownerWalkthroughAnswers: {
        steps: safeSteps,
        closingAnswer: safeClosing || null,
        savedAt: new Date().toISOString(),
      } as never,
    },
  });

  return NextResponse.json({ ok: true, saved: true });
}
