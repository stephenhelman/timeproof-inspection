import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";

// This route is public (homeowners view their report without a session), so the
// payload is attacker-reachable to anyone holding a report UUID. Bound everything
// it writes.
const MAX_SECTIONS = 50;
const STR_MAX = 500;
const SECTION_KEY_MAX = 100;
const SECONDS_MAX = 86_400; // one day, in case of a left-open tab

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "report:view", 60, 600);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { uuid } = await params;

  const inspection = await prisma.inspection.findUnique({
    where: { reportUuid: uuid },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { device, userAgent, sections } = body;

  // Validate and cap the sections payload before it reaches Prisma.
  const safeSections = (Array.isArray(sections) ? sections : [])
    .slice(0, MAX_SECTIONS)
    .filter((s) => s && typeof s.sectionKey === "string" && s.sectionKey.trim())
    .map((s: { sectionKey: string; secondsViewed: unknown }) => ({
      sectionKey: s.sectionKey.slice(0, SECTION_KEY_MAX),
      secondsViewed: Number.isFinite(Number(s.secondsViewed))
        ? Math.min(Math.max(Math.floor(Number(s.secondsViewed)), 0), SECONDS_MAX)
        : 0,
    }));

  const safeDevice = typeof device === "string" ? device.slice(0, STR_MAX) : null;
  const safeUserAgent = typeof userAgent === "string" ? userAgent.slice(0, STR_MAX) : null;

  const visitCount = await prisma.reportVisit.count({
    where: { inspectionId: inspection.id },
  });

  await prisma.reportVisit.create({
    data: {
      inspectionId: inspection.id,
      device: safeDevice,
      userAgent: safeUserAgent,
      visitNumber: visitCount + 1,
      sections: {
        create: safeSections,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
