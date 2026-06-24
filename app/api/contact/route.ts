import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { notifyManager } from "@/src/lib/ghl-sms";
import { checkRateLimit, getRequestIp } from "@/src/lib/rate-limit";
import { looksLikeGibberish, isPlausiblePhone, isPlausibleEmail } from "@/src/lib/spam-filter";

const NAME_MAX = 100;
const FIELD_MAX = 200;
const MESSAGE_MAX = 2000;

export async function POST(req: Request) {
  // Per-IP rate limit: 5 submissions per 10 minutes. Bounds automated flooding
  // before any work happens.
  const { ok, retryAfter } = checkRateLimit(getRequestIp(req), "contact", 5, 600);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, email, cityZip, message, hearAbout, website } = body;

  // Honeypot: a hidden field real users never see. If it is filled, this is a bot.
  // Return 400 without doing anything else (no lead, no SMS).
  if (website && website.trim()) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const cleanName = (name ?? "").trim();
  const cleanCityZip = (cityZip ?? "").trim();
  const cleanPhone = (phone ?? "").trim();
  const cleanEmail = (email ?? "").trim();
  const cleanMessage = (message ?? "").trim();

  // ── Validation (all side effects are gated behind this) ──
  if (!cleanName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (cleanName.length > NAME_MAX || cleanCityZip.length > FIELD_MAX || cleanMessage.length > MESSAGE_MAX) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  // Need at least one way to reach the person back.
  if (!cleanPhone && !cleanEmail) {
    return NextResponse.json({ error: "A phone or email is required" }, { status: 400 });
  }
  if (cleanPhone && !isPlausiblePhone(cleanPhone)) {
    return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
  }
  if (cleanEmail && !isPlausibleEmail(cleanEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  // Bots in the observed spam set name === address and used random tokens.
  if (cleanCityZip && cleanName.toLowerCase() === cleanCityZip.toLowerCase()) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  if (looksLikeGibberish(cleanName) || looksLikeGibberish(cleanCityZip)) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const zipMatch = cleanCityZip.match(/\d{5}/);
  const zip = zipMatch ? zipMatch[0] : "";

  const fullMessage = [
    cleanMessage || null,
    hearAbout?.trim() ? `Heard about us via: ${hearAbout.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const lead = await prisma.lead.create({
    data: {
      customerName: cleanName,
      streetAddress: cleanCityZip || "Contact form",
      city: cleanCityZip,
      state: "",
      zip: zip,
      phone: cleanPhone || null,
      email: cleanEmail || null,
      source: "contact_form",
      contactFormMessage: fullMessage || null,
    },
    select: { id: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
  await notifyManager(
    `New contact form submission — ${cleanName}${cleanPhone ? ` · ${cleanPhone}` : ""}${cleanCityZip ? ` · ${cleanCityZip}` : ""}\n${appUrl}/leads/${lead.id}`,
  ).catch((e) => console.warn("[contact] notifyManager failed:", e));

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
}
