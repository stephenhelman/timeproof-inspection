import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    name,
    phone,
    area,
    profileImageUrl,
    cardShowPhone,
    cardShowEmail,
    cardShowArea,
    cardShowReportLink,
    cardShowQr,
    cardShowProfileImage,
  } = body;

  // name is required if provided; other fields are optional updates
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  // Build update object with only provided fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name.trim();
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (area !== undefined) data.area = area?.trim() || null;
  if (profileImageUrl !== undefined) data.profileImageUrl = profileImageUrl || null;
  if (cardShowPhone !== undefined) data.cardShowPhone = Boolean(cardShowPhone);
  if (cardShowEmail !== undefined) data.cardShowEmail = Boolean(cardShowEmail);
  if (cardShowArea !== undefined) data.cardShowArea = Boolean(cardShowArea);
  if (cardShowReportLink !== undefined) data.cardShowReportLink = Boolean(cardShowReportLink);
  if (cardShowQr !== undefined) data.cardShowQr = Boolean(cardShowQr);
  if (cardShowProfileImage !== undefined) data.cardShowProfileImage = Boolean(cardShowProfileImage);

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
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

  return NextResponse.json({ success: true, user });
}
