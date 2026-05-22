import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

// ============================================================
// TERROS PAYLOAD MAP — UPDATE THIS WHEN YOU HAVE THE REAL SHAPE
// ============================================================
function normalizeTerrosPayload(raw: Record<string, unknown>) {
  return {
    customerName:  (raw.customer_name   ?? raw.name       ?? "") as string,
    address:       (raw.address         ?? raw.location    ?? "") as string,
    phone:         (raw.phone           ?? raw.mobile      ?? null) as string | null,
    email:         (raw.email                              ?? null) as string | null,
    appointmentAt: (raw.appointment_at  ?? raw.scheduled_at ?? null) as string | null,
    setterName:    (raw.setter_name     ?? raw.assigned_to ?? null) as string | null,
    externalId:    (raw.id              ?? raw.job_id      ?? null) as string | null,
  };
}
// ============================================================

export async function POST(req: Request) {
  const secret = req.headers.get("x-terros-secret");
  if (!secret || secret !== process.env.TERROS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown> = {};
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const payload = normalizeTerrosPayload(raw);

    const lead = await prisma.lead.create({
      data: {
        customerName: payload.customerName || "Unknown",
        streetAddress: "",
        city: "",
        state: "",
        zip: "",
        phone: payload.phone ?? undefined,
        email: payload.email ?? undefined,
        source: "terros_webhook",
        externalId: payload.externalId ?? undefined,
        status: payload.appointmentAt ? "INSPECTION_SCHEDULED" : "NEW",
        appointmentDate: payload.appointmentAt ? new Date(payload.appointmentAt) : undefined,
        assignedTech: payload.setterName ?? undefined,
      },
    });

    await prisma.webhookLog.create({
      data: {
        source: "terros",
        payload: raw as object,
        status: "success",
        leadId: lead.id,
      },
    });

    return NextResponse.json({ leadId: lead.id, created: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Terros webhook error:", errorMessage);

    await prisma.webhookLog.create({
      data: {
        source: "terros",
        payload: raw as object,
        status: "error",
        errorMessage,
      },
    }).catch(() => {});

    return NextResponse.json({ error: "Internal error — lead not created", created: false });
  }
}
