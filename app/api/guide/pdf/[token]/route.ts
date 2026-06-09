import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/src/lib/prisma";
import { generateGuidePdf, leadToGuidePayload } from "@/src/lib/guide-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  // Token now carries only { leadId } — re-derive the guide fields from the DB.
  let leadId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    leadId = (payload as { leadId?: string }).leadId ?? "";
  } catch {
    return NextResponse.redirect(new URL("/roof-guide", request.url));
  }

  const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
  if (!lead) {
    return NextResponse.redirect(new URL("/roof-guide", request.url));
  }

  try {
    const pdfBuffer = await generateGuidePdf(leadToGuidePayload(lead));
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="roof-health-guide.pdf"',
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[guide/pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
