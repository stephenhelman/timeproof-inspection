import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { generateGuidePdf, type GuideJWTPayload } from "@/src/lib/guide-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  let payload: GuideJWTPayload;
  try {
    const { payload: p } = await jwtVerify(token, secret);
    payload = p as unknown as GuideJWTPayload;
  } catch {
    return NextResponse.redirect(new URL("/roof-guide", request.url));
  }

  try {
    const pdfBuffer = await generateGuidePdf(payload);
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
