import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { notifyManager } from "@/src/lib/ghl-sms";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, email, cityZip, message, hearAbout } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Derive city/zip from the combined field
  const city = cityZip?.trim() || "";
  const zipMatch = city.match(/\d{5}/);
  const zip = zipMatch ? zipMatch[0] : "";

  // Build the full message with hearAbout appended if provided
  const fullMessage = [
    message?.trim(),
    hearAbout?.trim() ? `Heard about us via: ${hearAbout}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const lead = await prisma.lead.create({
    data: {
      customerName: name.trim(),
      streetAddress: city || "Contact form",
      city: city,
      state: "",
      zip: zip,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      source: "contact_form",
      contactFormMessage: fullMessage || null,
    },
    select: { id: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
  await notifyManager(
    `New contact form submission — ${name.trim()}${phone ? ` · ${phone.trim()}` : ""}${city ? ` · ${city}` : ""}\n${appUrl}/leads/${lead.id}`,
  ).catch((e) => console.warn("[contact] notifyManager failed:", e));

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
}
