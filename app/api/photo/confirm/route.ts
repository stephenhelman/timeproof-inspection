import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { inspectionId, r2Key, section, zone, damageTags, description } = body;

  if (!inspectionId || typeof inspectionId !== "string") {
    return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
  }
  if (!r2Key || typeof r2Key !== "string") {
    return NextResponse.json({ error: "Missing r2Key" }, { status: 400 });
  }

  const photoSection =
    typeof section === "string" && (section === "roof" || section === "attic")
      ? section
      : "roof";

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { photos: { select: { id: true } } },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  if (inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const r2Url = `${process.env.R2_PUBLIC_URL}/${r2Key}`;
  const photoNumber = inspection.photos.length + 1;

  const photo = await prisma.photo.create({
    data: {
      inspectionId,
      photoNumber,
      r2Key,
      r2Url,
      damageTags: Array.isArray(damageTags) ? (damageTags as string[]) : [],
      description: typeof description === "string" ? description : "",
      photoSection,
      zone: typeof zone === "string" && zone ? zone : null,
    },
  });

  return NextResponse.json({ ...photo }, { status: 201 });
}
