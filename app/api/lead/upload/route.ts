import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { uploadFileToR2 } from "@/src/lib/r2";

const ALLOWED_FIELDS = ["priorQuoteUrl", "eagleViewUrl"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const leadId = formData.get("leadId") as string | null;
    const field = formData.get("field") as string | null;

    if (!file || !leadId || !field) {
      return NextResponse.json({ error: "Missing file, leadId, or field" }, { status: 400 });
    }

    if (!ALLOWED_FIELDS.includes(field as (typeof ALLOWED_FIELDS)[number])) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const mimeType = file.type || "application/pdf";
    const ext = file.name.split(".").pop() ?? "pdf";
    const keyMap: Record<string, string> = {
      priorQuoteUrl: `leads/${leadId}/prior-quote.${ext}`,
      eagleViewUrl: `leads/${leadId}/eagleview.${ext}`,
    };
    const key = keyMap[field];

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { url } = await uploadFileToR2({ buffer, key, mimeType });

    await prisma.lead.update({
      where: { id: leadId },
      data: { [field]: url },
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Lead file upload error:", message);
    return NextResponse.json({ error: "Upload failed", detail: message }, { status: 500 });
  }
}
