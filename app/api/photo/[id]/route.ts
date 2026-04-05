import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { deleteFileFromDrive } from "@/src/lib/drive";
import { generatePhotoDescription } from "@/src/lib/findings";

async function getOwnedPhoto(id: string, userId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { inspection: true },
  });
  if (!photo || photo.inspection.userId !== userId) return null;
  return photo;
}

async function recomputeFindings(inspectionId: string) {
  const allPhotos = await prisma.photo.findMany({ where: { inspectionId } });
  const mergedFindings: Record<string, boolean> = {};
  allPhotos.forEach((photo) => {
    photo.damageTags.forEach((tag) => {
      mergedFindings[tag] = true;
    });
  });
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { findings: mergedFindings },
  });
  return mergedFindings;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const photo = await getOwnedPhoto(id, session.user.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { damageTags, description } = body;

  const updateData: Record<string, unknown> = {};

  if (damageTags !== undefined) {
    updateData.damageTags = damageTags;
    // Auto-generate description from tags (unless description is also being set manually)
    if (description === undefined) {
      updateData.description = generatePhotoDescription(damageTags);
    }
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  const updated = await prisma.photo.update({ where: { id }, data: updateData });

  const findings = await recomputeFindings(photo.inspectionId);

  return NextResponse.json({ photo: updated, findings });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const photo = await getOwnedPhoto(id, session.user.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete from Drive
  try {
    await deleteFileFromDrive(photo.driveFileId);
  } catch {
    // Continue even if Drive delete fails (file may already be gone)
  }

  const inspectionId = photo.inspectionId;
  await prisma.photo.delete({ where: { id } });

  // Recompute findings
  await recomputeFindings(inspectionId);

  // Renumber remaining photos
  const remaining = await prisma.photo.findMany({
    where: { inspectionId },
    orderBy: { photoNumber: "asc" },
  });

  await Promise.all(
    remaining.map((p, i) =>
      prisma.photo.update({ where: { id: p.id }, data: { photoNumber: i + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
