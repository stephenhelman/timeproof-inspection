import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { createInspectionFolder, uploadFileToDrive } from "@/src/lib/drive";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const inspectionId = formData.get("inspectionId") as string | null;

  if (!file || !inspectionId) {
    return NextResponse.json({ error: "Missing file or inspectionId" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { customer: true },
  });

  if (!inspection || inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create Drive folder if this is the first photo
  let folderId = inspection.driveFolderId;
  let folderUrl = inspection.driveFolderUrl;

  if (!folderId) {
    const customerName = inspection.customer?.name ?? "Unknown";
    const address = inspection.customer?.address ?? "Unknown";
    const date = new Date(inspection.date).toISOString().split("T")[0];

    const folder = await createInspectionFolder(customerName, address, date);
    folderId = folder.folderId;
    folderUrl = folder.folderUrl;

    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { driveFolderId: folderId, driveFolderUrl: folderUrl },
    });
  }

  // Upload to Drive
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = file.name || `photo-${Date.now()}.jpg`;
  const mimeType = file.type || "image/jpeg";

  const { fileId, fileUrl } = await uploadFileToDrive(buffer, filename, mimeType, folderId);

  // Get next photo number
  const count = await prisma.photo.count({ where: { inspectionId } });
  const photoNumber = count + 1;

  const photo = await prisma.photo.create({
    data: {
      inspectionId,
      photoNumber,
      driveFileId: fileId,
      driveUrl: fileUrl,
      damageTags: [],
    },
  });

  return NextResponse.json({ ...photo, driveFolderUrl: folderUrl }, { status: 201 });
}
