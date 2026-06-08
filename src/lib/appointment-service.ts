import { prisma } from "@/src/lib/prisma";
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
  // The calendar event is created by a downstream GHL automation, not here.
  // We previously called GHL's calendar API directly; when it failed (which it
  // did for every booking, since the automation owns it), ghlSyncPending was set
  // true and silently suppressed the opportunity field writes, the APPOINTMENT_SET
  // stage move, the rep assignment, and the homeowner confirmation SMS below.
  // Removing the call and keeping ghlSyncPending false restores all of that.
  const ghlCalendarEventId: string | null = null;
  const ghlSyncPending = false;
  const ghlContactId = lead.ghlContactId ?? null;

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
