import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// Public endpoint — no auth required.
// Returns the rep's card data, filtered by their cardShow* toggles.
// Optional ?report=<reportUuid> includes a link to that inspection's summary.
export async function GET(
  req: Request,
  { params }: { params: { repId: string } }
) {
  const { repId } = params;
  const { searchParams } = new URL(req.url);
  const reportUuid = searchParams.get("report");

  const user = await prisma.user.findUnique({
    where: { id: repId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      area: true,
      profileImageUrl: true,
      cardShowPhone: true,
      cardShowEmail: true,
      cardShowArea: true,
      cardShowReportLink: true,
      cardShowQr: true,
      cardShowProfileImage: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build response object respecting each toggle
  // TODO: verify field names match the final Prisma schema after migration
  const card = {
    id: user.id,
    name: user.name,
    email: user.cardShowEmail ? user.email : null,
    phone: user.cardShowPhone ? user.phone : null,
    area: user.cardShowArea ? user.area : null,
    profileImageUrl: user.cardShowProfileImage ? user.profileImageUrl : null,
    cardShowPhone: user.cardShowPhone,
    cardShowEmail: user.cardShowEmail,
    cardShowArea: user.cardShowArea,
    cardShowReportLink: user.cardShowReportLink,
    cardShowQr: user.cardShowQr,
    cardShowProfileImage: user.cardShowProfileImage,
    reportUrl: null as string | null,
  };

  if (reportUuid && user.cardShowReportLink) {
    // Verify the report belongs to this rep before including the link
    const inspection = await prisma.inspection.findFirst({
      where: { reportUuid, userId: repId },
      select: { reportUuid: true },
    });
    if (inspection) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      card.reportUrl = `${appUrl}/summary/${inspection.reportUuid}`;
    }
  }

  return NextResponse.json(card);
}
