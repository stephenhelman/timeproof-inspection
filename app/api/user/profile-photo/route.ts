import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { uploadFileToR2 } from "@/src/lib/r2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    const ext = mimeType.split("/")[1] ?? "jpg";
    const key = `profiles/${session.user.id}/profile-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { url } = await uploadFileToR2({ buffer, key, mimeType });

    return NextResponse.json({ url, key }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Profile photo upload error:", message);
    return NextResponse.json({ error: "Upload failed", detail: message }, { status: 500 });
  }
}
