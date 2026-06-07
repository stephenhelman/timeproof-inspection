import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { generatePresignedPutUrl } from "@/src/lib/r2";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "heif", "webp"]);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const inspectionId = searchParams.get("inspectionId");
  const section = searchParams.get("section");
  const filename = searchParams.get("filename");

  if (!inspectionId || !filename) {
    return NextResponse.json(
      { error: "Missing inspectionId or filename" },
      { status: 400 },
    );
  }

  if (section !== "roof" && section !== "attic") {
    return NextResponse.json(
      { error: "section must be roof or attic" },
      { status: 400 },
    );
  }

  const rawExt = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(rawExt)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: jpg, png, heic, webp" },
      { status: 400 },
    );
  }
  // Normalise jpeg → jpg in the stored key
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { userId: true },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  if (inspection.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const r2Key = `inspections/${inspectionId}/${section}/${randomUUID()}.${ext}`;
  const presignedUrl = await generatePresignedPutUrl({ key: r2Key, expiresIn: 300 });

  return NextResponse.json({ presignedUrl, r2Key });
}
