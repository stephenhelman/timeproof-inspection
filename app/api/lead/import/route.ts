import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

function clean(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).replace(/^'/, "").replace(/\r\n/g, " ").trim();
}

function parseDate(val: unknown): Date | null {
  const s = clean(val);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseFloat2(val: unknown): number | null {
  const s = clean(val).replace(/[$,]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function mapStatus(val: unknown): string {
  const s = clean(val);
  if (s === "Sold") return "SOLD";
  return "REVIVAL_PENDING";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => []);
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "Expected non-empty array of rows" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];
  let revivalFlagged = 0;

  for (const row of rows) {
    const customerName = clean(row["Customer"]);
    const address = clean(row["Location Address"]);
    if (!customerName && !address) continue;

    const status = mapStatus(row["Opportunity Status"]);
    if (status === "REVIVAL_PENDING") revivalFlagged++;

    data.push({
      customerName: customerName || "(Unknown)",
      address: address || "",
      phone: clean(row["Phone"]) || null,
      assignedTech: clean(row["Technician"]) || null,
      createdBy: clean(row["Created By"]) || null,
      source: "servicetitan_import",
      highestEstimateValue: parseFloat2(row["Highest Estimate Value"]),
      appointmentDate: parseDate(row["Created On"]),
      jobCompletionDate: parseDate(row["Job Completion Date"]),
      status,
      assignedUserId: session.user.id,
    });
  }

  if (data.length === 0) {
    return NextResponse.json({ imported: 0, revivalFlagged: 0 });
  }

  await prisma.lead.createMany({ data, skipDuplicates: false });

  return NextResponse.json({ imported: data.length, revivalFlagged });
}
