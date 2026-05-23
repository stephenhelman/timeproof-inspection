import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

const LIMIT = Number(process.env.NEXT_PUBLIC_GALLERY_PHOTO_LIMIT || 20);

export const revalidate = 60;

export async function GET() {
  const photos = await prisma.photo.findMany({
    where: {
      galleryEligible: true,
      inspection: {
        status: "complete",
      },
    },
    select: {
      r2Url: true,
      damageTags: true,
      photoSection: true,
      cityArea: true,
      description: true,
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  return NextResponse.json({ photos }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
