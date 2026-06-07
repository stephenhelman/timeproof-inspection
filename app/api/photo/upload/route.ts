import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { uploadFileToR2, generatePhotoKey } from "@/src/lib/r2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const inspectionId = formData.get("inspectionId") as string | null;
    const photoSection = (formData.get("photoSection") as string | null) || "roof";
    const zone = (formData.get("zone") as string | null) || null;

    if (!file || !inspectionId) {
      return NextResponse.json({ error: "Missing file or inspectionId" }, { status: 400 });
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: jpg, png, heic, webp" }, { status: 400 });
    }

    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum size is 20MB" }, { status: 400 });
    }

    // Verify ownership
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        photos: { select: { id: true } },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    if (inspection.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate photo number and R2 key
    const photoNumber = inspection.photos.length + 1;
    const mimeType = file.type || "image/jpeg";

    const r2Key = generatePhotoKey({ inspectionId, photoNumber, mimeType });

    // Convert to buffer and upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { url: r2Url } = await uploadFileToR2({ buffer, key: r2Key, mimeType });

    // Save photo record
    const photo = await prisma.photo.create({
      data: {
        inspectionId,
        photoNumber,
        r2Key,
        r2Url,
        damageTags: [],
        description: "",
        photoSection,
        zone,
      },
    });

    return NextResponse.json({ ...photo }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Photo upload error:", message);
    return NextResponse.json({ error: "Upload failed", detail: message }, { status: 500 });
  }
}
