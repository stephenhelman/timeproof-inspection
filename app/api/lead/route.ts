import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canCreateLead, canViewAllLeads, buildLeadScope } from "@/src/lib/permissions";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canCreateLead(user.role)) return forbidden("Your role cannot create leads");

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
    assignedUserId,
    setterUserId,
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
      assignedUserId: assignedUserId || user.id,
      setterUserId: setterUserId || null,
    },
    include: { inspections: true },
  });

  return NextResponse.json(lead, { status: 201 });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Resolve subordinate IDs for SETTER_MANAGER scoping
  let subordinateIds: string[] | undefined;
  if (user.role === "SETTER_MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    subordinateIds = reports.map((r) => r.id);
  }

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
  const scope = buildLeadScope(user.id, user.role, subordinateIds) as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: Record<string, any> = {};

  if (status) filters.status = status;
  if (revivalStatus) filters.revivalStatus = revivalStatus;
  if (assignedTech) filters.assignedTech = { contains: assignedTech, mode: "insensitive" };
  if (source) filters.source = source;
  if (zip) filters.zip = { contains: zip, mode: "insensitive" };
  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) filters.createdAt.gte = new Date(dateFrom);
    if (dateTo) filters.createdAt.lte = new Date(dateTo);
  }

  const where = Object.keys(scope).length > 0
    ? { AND: [scope, filters] }
    : filters;

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
      inspections: {
        where: { status: "scheduled" },
        orderBy: { appointmentAt: "asc" },
        take: 1,
        select: { appointmentAt: true },
      },
    },
  });

  return NextResponse.json(leads);
}
