import { prisma } from "@/src/lib/prisma";
import { CalendarsClient } from "ghl-sdk";
import type { AppointmentSource } from "@prisma/client";
import { sendGhlSms } from "@/src/lib/ghl-sms";
import {
  writeGhlOpportunityCustomField,
  moveGhlOpportunityStage,
  assignGhlOpportunityRep,
} from "@/src/lib/ghl-contacts";
import { getZoneForZip } from "@/src/lib/service-zones";

// ── Slot-to-UTC conversion ────────────────────────────────────────────────
// Converts a wall-clock slot ("2026-06-10", "09:00") in BOT_TIMEZONE to UTC.
export function slotToUtc(slotDate: string, slotTime: string): Date {
  const [year, month, day] = slotDate.split("-").map(Number);
  const [hour, minute] = slotTime.split(":").map(Number);
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const pts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const h = parseInt(pts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const off = h * 60 + m - (hour * 60 + minute);
  return new Date(guess.getTime() - off * 60 * 1000);
}

// ── GHL calendar client ───────────────────────────────────────────────────

function getCalendarsClient(): CalendarsClient {
  const key = process.env.GHL_API_KEY;
  if (!key) throw new Error("GHL_API_KEY is not set");
  return new CalendarsClient(key);
}

// ── Core booking utility ──────────────────────────────────────────────────

export interface CreateAppointmentInput {
  leadId: string;
  assignedUserId: string;
  scheduledAt: Date;
  slotLabel?: string;
  zone: string;
  createdBy: AppointmentSource;
}

export interface CreateAppointmentResult {
  appointmentId: string;
  inspectionId: string;
  ghlSyncPending: boolean;
}

export async function createAppointmentWithInspection(
  input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  const { leadId, assignedUserId, scheduledAt, slotLabel, zone, createdBy } =
    input;

  // Load lead for GHL integration data
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: {
      id: true,
      customerName: true,
      address: true,
      phone: true,
      ghlContactId: true,
      ghlOpportunityId: true,
      streetAddress: true,
      city: true,
      state: true,
    },
  });

  // Load assigned user for GHL user ID
  const assignedUser = await prisma.user.findUnique({
    where: { id: assignedUserId },
    select: { ghlUserId: true },
  });

  const inspectionAddress =
    lead.address ??
    [lead.streetAddress, lead.city, lead.state].filter(Boolean).join(", ") ??
    "";

  // ── GHL calendar event ──────────────────────────────────────────────────
  let ghlCalendarEventId: string | null = null;
  let ghlSyncPending = false;

  const calendarId = process.env.GHL_CALENDAR_ID;
  const locationId = process.env.GHL_LOCATION_ID;
  const ghlContactId = lead.ghlContactId ?? null;

  if (calendarId && locationId && ghlContactId) {
    try {
      const calendars = getCalendarsClient();
      const endTime = new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000);
      const result = await calendars.createAppointment({
        calendarId,
        locationId,
        contactId: ghlContactId,
        startTime: scheduledAt.toISOString(),
        endTime: endTime.toISOString(),
        title: `Roof Inspection — ${lead.customerName}`,
        assignedUserId: assignedUser?.ghlUserId ?? undefined,
        address: inspectionAddress || undefined,
      });
      ghlCalendarEventId = result.id ?? null;
    } catch (err) {
      console.error("[appointment-service] GHL calendar event failed:", err);
      ghlSyncPending = true;
    }
  } else {
    console.warn(
      "[appointment-service] GHL calendar env vars missing — marking ghlSyncPending",
      { calendarId: !!calendarId, locationId: !!locationId, ghlContactId: !!ghlContactId },
    );
    ghlSyncPending = true;
  }

  // ── Create DB records ───────────────────────────────────────────────────
  const inspection = await prisma.inspection.create({
    data: {
      userId: assignedUserId,
      leadId,
      customerName: lead.customerName,
      address: inspectionAddress,
      phone: lead.phone ?? null,
      status: "scheduled",
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      leadId,
      inspectionId: inspection.id,
      assignedUserId,
      scheduledAt,
      createdBy,
      ghlCalendarEventId,
      ghlOpportunityId: lead.ghlOpportunityId ?? null,
      ghlSyncPending,
    },
  });

  // ── GHL opportunity writes ──────────────────────────────────────────────
  if (!ghlSyncPending && lead.ghlOpportunityId) {
    const oppId = lead.ghlOpportunityId;
    const ghlUserId = assignedUser?.ghlUserId ?? null;

    await Promise.allSettled([
      process.env.GHL_FIELD_OPP_SR_APPOINTMENT_ID
        ? writeGhlOpportunityCustomField(
            oppId,
            process.env.GHL_FIELD_OPP_SR_APPOINTMENT_ID,
            appointment.id,
          )
        : Promise.resolve(),
      process.env.GHL_FIELD_OPP_SR_INSPECTION_ID
        ? writeGhlOpportunityCustomField(
            oppId,
            process.env.GHL_FIELD_OPP_SR_INSPECTION_ID,
            inspection.id,
          )
        : Promise.resolve(),
      process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME
        ? writeGhlOpportunityCustomField(
            oppId,
            process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME,
            scheduledAt.toISOString(),
          )
        : Promise.resolve(),
      process.env.GHL_STAGE_APPOINTMENT_SET
        ? moveGhlOpportunityStage(oppId, process.env.GHL_STAGE_APPOINTMENT_SET)
        : Promise.resolve(),
      ghlUserId
        ? assignGhlOpportunityRep(oppId, ghlUserId)
        : Promise.resolve(),
    ]);
  }

  // ── GHL fallback log ────────────────────────────────────────────────────
  if (ghlSyncPending) {
    await prisma.webhookLog.create({
      data: {
        source: "appointment_ghl_sync_pending",
        payload: {
          appointmentId: appointment.id,
          inspectionId: inspection.id,
          leadId,
          zone,
          createdBy,
        },
        status: "error",
        errorMessage: "GHL calendar event creation failed — sync pending",
        leadId,
      },
    }).catch((err) =>
      console.error("[appointment-service] webhookLog create failed:", err),
    );
  }

  // ── Homeowner confirmation SMS ──────────────────────────────────────────
  if (!ghlSyncPending && ghlContactId && lead.customerName) {
    const firstName = lead.customerName.trim().split(/\s+/)[0];
    const timeLabel =
      slotLabel ??
      scheduledAt.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: process.env.BOT_TIMEZONE ?? "America/Denver",
      });
    const sms =
      `Hi ${firstName}! Your roof inspection is confirmed for ${timeLabel}. ` +
      `We'll be there at ${inspectionAddress || "your address"}. See you then!`;
    await sendGhlSms(ghlContactId, sms).catch((err) =>
      console.error("[appointment-service] homeowner SMS failed:", err),
    );
  }

  void zone; // used by caller for SlotLock; service receives it for future use

  return {
    appointmentId: appointment.id,
    inspectionId: inspection.id,
    ghlSyncPending,
  };
}

// ── Zone derivation helper ────────────────────────────────────────────────
// Derives zone from lead's sourceZip, falling back to a default.
export function deriveZoneForLead(sourceZip: string | null): string {
  return (sourceZip ? getZoneForZip(sourceZip) : null) ?? "el_paso_central";
}
