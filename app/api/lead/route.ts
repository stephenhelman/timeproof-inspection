import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    customerName,
    streetAddress,
    city,
    state,
    zip,
    phone,
    email,
    assignedTech,
    source,
    highestEstimateValue,
    appointmentDate,
    jobCompletionDate,
    status,
  } = body;

  if (!customerName || !streetAddress) {
    return NextResponse.json(
      { error: "customerName and streetAddress are required" },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.create({
    data: {
      customerName,
      streetAddress,
      city: city || "",
      state: state || "",
      zip: zip || "",
      phone: phone || null,
      email: email || null,
      assignedTech: assignedTech || null,
      source: source || "manual",
      highestEstimateValue: highestEstimateValue ?? null,
      appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
      jobCompletionDate: jobCompletionDate ? new Date(jobCompletionDate) : null,
      status: status || "NEW",
      assignedUserId: session.user.id,
    },
    include: { inspections: true },
  });

  return NextResponse.json(lead, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const revivalStatus = searchParams.get("revivalStatus");
  const assignedTech = searchParams.get("assignedTech");
  const source = searchParams.get("source");
  const zip = searchParams.get("zip");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const sortBy = searchParams.get("sortBy");
  const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (user?.role === "REP") {
    where.assignedUserId = session.user.id;
  }

  if (status) where.status = status;
  if (revivalStatus) where.revivalStatus = revivalStatus;
  if (assignedTech) where.assignedTech = { contains: assignedTech, mode: "insensitive" };
  if (source) where.source = source;
  if (zip) where.zip = { contains: zip, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: Record<string, any> = { updatedAt: "desc" };
  if (sortBy === "appointmentDate") orderBy = { appointmentDate: sortDir };
  else if (sortBy === "zip") orderBy = { zip: sortDir };
  else if (sortBy === "highestEstimateValue") orderBy = { highestEstimateValue: sortDir };

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { inspections: true } },
    },
  });

  return NextResponse.json(leads);
}
