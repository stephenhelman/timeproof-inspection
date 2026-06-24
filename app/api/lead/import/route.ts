import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/src/lib/require-permission";
import { canImportLeads } from "@/src/lib/permissions";

function clean(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).replace(/^'/, "").trim();
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

function parseAddress(val: unknown): {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
} {
  const raw = String(val ?? "").replace(/^'/, "").trim();

  // Split on literal \r\n (CSV escape sequence) or actual CRLF/LF
  const lines = raw.split(/\\r\\n|\r\n|\n/);

  if (lines.length >= 2) {
    const streetAddress = lines[0].trim();
    const cityStateZip = lines[1].trim(); // e.g. "EL PASO, TX 79912 USA"

    const lastComma = cityStateZip.lastIndexOf(",");
    if (lastComma !== -1) {
      const city = cityStateZip.slice(0, lastComma).trim();
      const stateZipCountry = cityStateZip.slice(lastComma + 1).trim(); // "TX 79912 USA"
      const zipMatch = stateZipCountry.match(/\b(\d{5})\b/);
      const stateMatch = stateZipCountry.match(/^([A-Z]{2})\b/);
      return {
        streetAddress,
        city,
        state: stateMatch ? stateMatch[1] : "",
        zip: zipMatch ? zipMatch[1] : "",
      };
    }
    return { streetAddress, city: cityStateZip, state: "", zip: "" };
  }

  // No newline — try splitting on last comma as fallback
  const lastComma = raw.lastIndexOf(",");
  if (lastComma !== -1) {
    const streetCity = raw.slice(0, lastComma).trim();
    const stateZipCountry = raw.slice(lastComma + 1).trim();
    const zipMatch = stateZipCountry.match(/\b(\d{5})\b/);
    const stateMatch = stateZipCountry.match(/^([A-Z]{2})\b/);
    return {
      streetAddress: streetCity,
      city: "",
      state: stateMatch ? stateMatch[1] : "",
      zip: zipMatch ? zipMatch[1] : "",
    };
  }

  return { streetAddress: raw, city: "", state: "", zip: "" };
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!canImportLeads(user.role)) return forbidden("Only managers can import leads");

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
    const rawAddress = row["Location Address"];
    if (!customerName && !rawAddress) continue;

    const { streetAddress, city, state, zip } = parseAddress(rawAddress);
    const status = mapStatus(row["Opportunity Status"]);
    if (status === "REVIVAL_PENDING") revivalFlagged++;

    data.push({
      customerName: customerName || "(Unknown)",
      streetAddress: streetAddress || "",
      city: city || "",
      state: state || "",
      zip: zip || "",
      phone: clean(row["Phone"]) || null,
      assignedTech: clean(row["Technician"]) || null,
      createdBy: clean(row["Created By"]) || null,
      source: "servicetitan_import",
      highestEstimateValue: parseFloat2(row["Highest Estimate Value"]),
      jobCompletionDate: parseDate(row["Job Completion Date"]),
      status,
      assignedUserId: user.id,
    });
  }

  if (data.length === 0) {
    return NextResponse.json({ imported: 0, revivalFlagged: 0 });
  }

  await prisma.lead.createMany({ data, skipDuplicates: false });

  return NextResponse.json({ imported: data.length, revivalFlagged });
}
