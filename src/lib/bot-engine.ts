import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead, type SrLeadFields } from "@/src/lib/ghl-custom-object";
import {
  SERVICE_ZONES,
  ZONE_COMPATIBILITY,
  AVAILABLE_TIMES,
  MAX_INSPECTIONS_PER_DAY_PER_ZONE,
  BOOKING_WINDOW_DAYS,
  SLOT_LOCK_EXPIRY_MINUTES,
  DISTANCE_ZONE_MIN_DAYS_AHEAD,
  getZoneForZip,
  getCompatibleZones,
} from "@/src/lib/service-zones";
import type { LeadStatus } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────

export interface BotMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Thread management ──────────────────────────────────────────

export async function getOrCreateThread(
  ghlContactId: string,
  botType: "qualify" | "book" | "revival" | "reschedule" | "finance" | "nurture"
): Promise<{ id: string; messages: BotMessage[]; isNew: boolean }> {
  const existing = await prisma.botThread.findUnique({
    where: { ghlContactId_botType: { ghlContactId, botType } },
  });
  if (existing) {
    return {
      id: existing.id,
      messages: (existing.messages as unknown as BotMessage[]) ?? [],
      isNew: false,
    };
  }
  const created = await prisma.botThread.create({
    data: { ghlContactId, botType, messages: [] },
  });
  return { id: created.id, messages: [], isNew: true };
}

export async function appendMessage(
  threadId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  const messages = (thread.messages as unknown as BotMessage[]) ?? [];
  messages.push({ role, content, timestamp: new Date().toISOString() });
  await prisma.botThread.update({
    where: { id: threadId },
    data: { messages: messages as unknown as never, lastMessageAt: new Date() },
  });
}

// ── Claude API ─────────────────────────────────────────────────

// Fallback: add SDK here if raw fetch is replaced with @anthropic-ai/sdk
// Returns null when Claude signals [ESCALATE] — caller must skip sending SMS.
export async function runBot(
  systemPrompt: string,
  messages: BotMessage[]
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[bot-engine] ANTHROPIC_API_KEY not set — bot call skipped");
    return "Hey, just wanted to follow up — is now a good time to connect?";
  }

  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: apiMessages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[bot-engine] Claude API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { content: { text: string }[] };
  const text = data.content[0]?.text ?? "";

  if (text.includes("[ESCALATE]")) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    await notifyManager(
      `[ESCALATION] Bot conversation needs human review.\nLast message: "${lastUserMsg.slice(0, 120)}"`
    ).catch((e) => console.warn("[bot-engine] escalation notifyManager failed:", e));
    return null;
  }

  return text;
}

// ── Lead transition ────────────────────────────────────────────

export async function transitionLead(
  leadId: string,
  ghlContactId: string,
  fromTag: string | null,
  toTag: string | null,
  newStatus: LeadStatus,
  newBotStage: string,
  srLeadUpdates?: Partial<SrLeadFields>
): Promise<void> {
  // 1. Update Lead in DB — awaited
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: newStatus,
      lastBotType: newBotStage,
      lastBotMessage: new Date(),
    },
  });

  // 2. Update SrLead in DB — awaited (best-effort: may not exist for legacy leads)
  await prisma.srLead.update({
    where: { leadId },
    data: {
      srBotStage: newBotStage,
      srStatus: srLeadUpdates?.sr_status ?? (newStatus as string),
      updatedAt: new Date(),
    },
  }).catch(e => console.warn("[bot-engine] srLead.update failed (may not exist):", e));

  // 3. GHL updates — parallel, non-blocking. DB is source of truth.
  Promise.allSettled([
    fromTag
      ? removeGhlTag(ghlContactId, fromTag)
          .catch(e => console.error(`[bot-engine] removeGhlTag(${fromTag}) failed:`, e))
      : Promise.resolve(),
    toTag
      ? addGhlTag(ghlContactId, toTag)
          .catch(e => console.error(`[bot-engine] addGhlTag(${toTag}) failed:`, e))
      : Promise.resolve(),
    srLeadUpdates
      ? updateSrLead(leadId, srLeadUpdates)
          .catch(e => console.error("[bot-engine] updateSrLead failed:", e))
      : Promise.resolve(),
  ]);
  // Intentionally not awaited — fire and forget
}

// ── Opt-out and cancellation ───────────────────────────────────

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "quit", "end"];

// 'cancel' is intentionally excluded here — handled as appointment cancellation
export function isOptOut(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.includes(normalized);
}

const CANCEL_PHRASES = [
  "cancel",
  "cancel my appointment",
  "want to cancel",
  "need to cancel",
  "don't come",
  "not interested anymore",
  "changed my mind",
];

export function isCancellation(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return CANCEL_PHRASES.some((phrase) => normalized.includes(phrase));
}

// ── Slot management ────────────────────────────────────────────

export async function purgeExpiredSlotLocks(): Promise<void> {
  await prisma.slotLock.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLabel(date: Date, time: string, timezone: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(hour, minute, 0, 0);

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(dt);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(dt);

  return `${dayLabel} at ${timeLabel.toLowerCase()}`;
}

async function fetchGhlFreeSlots(
  startDate: string,
  endDate: string
): Promise<Record<string, string[]>> {
  const calendarId = process.env.GHL_CALENDAR_ID;
  const apiKey = process.env.GHL_API_KEY;
  const timezone = process.env.BOT_TIMEZONE ?? "America/Denver";

  if (!calendarId || !apiKey) {
    console.warn("[bot-engine] GHL_CALENDAR_ID or GHL_API_KEY not set — skipping calendar check");
    return {};
  }

  try {
    const url = new URL(
      `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`
    );
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("timezone", timezone);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-04-15",
      },
    });

    if (!res.ok) {
      console.error(`[bot-engine] GHL calendar API ${res.status}`);
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    // Normalize: handle both {slots:{date:[times]}} and {slots:{date:{slots:[times]}}}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any> = data?.slots ?? {};
    const result: Record<string, string[]> = {};
    for (const [date, val] of Object.entries(raw)) {
      if (Array.isArray(val)) {
        result[date] = val.map((t: string) => t.slice(0, 5)); // "09:00:00" → "09:00"
      } else if (val?.slots && Array.isArray(val.slots)) {
        result[date] = val.slots.map((t: string) => t.slice(0, 5));
      }
    }
    return result;
  } catch (err) {
    console.error("[bot-engine] fetchGhlFreeSlots error:", err);
    return {};
  }
}

export async function getAvailableSlots(
  leadZone: string,
  isDistance: boolean
): Promise<Array<{ date: string; time: string; label: string }>> {
  const timezone = process.env.BOT_TIMEZONE ?? "America/Denver";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const windowStart = addDays(today, isDistance ? DISTANCE_ZONE_MIN_DAYS_AHEAD : 0);
  const windowEnd = addDays(today, BOOKING_WINDOW_DAYS);

  const startStr = windowStart.toISOString().slice(0, 10);
  const endStr = windowEnd.toISOString().slice(0, 10);

  const [ghlSlots, existingLocks] = await Promise.all([
    fetchGhlFreeSlots(startStr, endStr),
    prisma.slotLock.findMany({
      where: { expiresAt: { gt: new Date() } },
    }),
  ]);

  const compatibleZones = getCompatibleZones(leadZone);
  const allCompatible = new Set([leadZone, ...compatibleZones]);

  const results: Array<{ date: string; time: string; label: string }> = [];

  for (let d = 0; d < BOOKING_WINDOW_DAYS + 1 && results.length < 3; d++) {
    const dayDate = addDays(today, d);
    if (dayDate < windowStart) continue;

    const dateStr = dayDate.toISOString().slice(0, 10);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Check 6: distance zone minimum days ahead
    if (isDistance) {
      const daysAhead = Math.floor((dayDate.getTime() - today.getTime()) / 86400000);
      if (daysAhead < DISTANCE_ZONE_MIN_DAYS_AHEAD) continue;
    }

    // Load confirmed inspections for this day to check zone conflicts + count
    const dayInspections = await prisma.inspection.findMany({
      where: { appointmentAt: { gte: dayStart, lte: dayEnd } },
      include: { lead: { select: { sourceZip: true } } },
    });

    // Build zone list for confirmed inspections this day
    const inspZones = dayInspections
      .map((i) => i.lead?.sourceZip ? getZoneForZip(i.lead.sourceZip) : null)
      .filter(Boolean) as string[];

    // Check 3: no confirmed inspection in incompatible zone
    const hasIncompatibleInspection = inspZones.some(
      (z) => z !== leadZone && !allCompatible.has(z)
    );
    if (hasIncompatibleInspection) continue;

    // Check 5: zone hasn't hit max inspections
    const zoneInspectionCount = inspZones.filter((z) => z === leadZone).length;
    if (zoneInspectionCount >= MAX_INSPECTIONS_PER_DAY_PER_ZONE) continue;

    // Build lock zone list for this day
    const dayLocks = existingLocks.filter(
      (l) => l.date >= dayStart && l.date <= dayEnd
    );
    const lockZones = dayLocks.map((l) => l.zone);

    // Check 4: no pending slot lock in incompatible zone
    const hasIncompatibleLock = lockZones.some(
      (z) => z !== leadZone && !allCompatible.has(z)
    );
    if (hasIncompatibleLock) continue;

    const ghlAvail = new Set(ghlSlots[dateStr] ?? AVAILABLE_TIMES);

    for (const time of AVAILABLE_TIMES) {
      if (results.length >= 3) break;

      // Check 1: GHL calendar free
      if (Object.keys(ghlSlots).length > 0 && !ghlAvail.has(time)) continue;

      // Check 2: no exact SlotLock on this date+time
      const exactLock = existingLocks.find(
        (l) => l.date.toISOString().slice(0, 10) === dateStr && l.time === time
      );
      if (exactLock) continue;

      results.push({
        date: dateStr,
        time,
        label: formatDateLabel(dayDate, time, timezone),
      });
    }
  }

  return results;
}

export async function createSlotLock(args: {
  date: Date;
  time: string;
  zone: string;
  leadId: string;
}): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SLOT_LOCK_EXPIRY_MINUTES * 60 * 1000
  );
  await prisma.slotLock.upsert({
    where: { leadId: args.leadId },
    update: { date: args.date, time: args.time, zone: args.zone, expiresAt },
    create: { date: args.date, time: args.time, zone: args.zone, leadId: args.leadId, expiresAt },
  });
}

export async function validateSlotBeforeConfirm(
  leadId: string,
  date: Date,
  time: string,
  zone: string
): Promise<{ ok: boolean; reason?: "expired" | "zone_conflict" }> {
  // Stage 1: check SlotLock is still valid and owned by this lead
  const lock = await prisma.slotLock.findUnique({ where: { leadId } });
  if (!lock || lock.expiresAt < new Date()) {
    return { ok: false, reason: "expired" };
  }

  // Stage 2: check for incompatible zone inspections added since lock was created
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const newInspections = await prisma.inspection.findMany({
    where: {
      appointmentAt: { gte: dayStart, lte: dayEnd },
      createdAt: { gt: lock.createdAt },
    },
    include: { lead: { select: { sourceZip: true } } },
  });

  const compatibleZones = new Set([zone, ...getCompatibleZones(zone)]);
  const conflict = newInspections.some((i) => {
    const z = i.lead?.sourceZip ? getZoneForZip(i.lead.sourceZip) : null;
    return z && !compatibleZones.has(z);
  });

  if (conflict) return { ok: false, reason: "zone_conflict" };
  return { ok: true };
}

export async function confirmBooking(
  leadId: string,
  ghlContactId: string,
  datetime: Date
): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`confirmBooking: lead ${leadId} not found`);

  // Delete the slot lock
  await prisma.slotLock.deleteMany({ where: { leadId } });

  // Create Inspection record if there's a valid userId (required field)
  if (lead.assignedUserId) {
    await prisma.inspection.create({
      data: {
        userId: lead.assignedUserId,
        leadId: lead.id,
        customerName: lead.customerName,
        address: [lead.streetAddress, lead.city, lead.state].filter(Boolean).join(", "),
        phone: lead.phone ?? null,
        appointmentAt: datetime,
        status: "scheduled",
      },
    });
  } else {
    console.warn(`[bot-engine] confirmBooking: lead ${leadId} has no assignedUserId — inspection record not created`);
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "INSPECTION_SCHEDULED", appointmentDate: datetime },
  });
}

// ── Rep notification ───────────────────────────────────────────

export async function notifyRep(
  repId: string,
  leadId: string,
  message: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: repId } });
  if (!user) {
    console.warn(`[bot-engine] notifyRep: user ${repId} not found`);
    return;
  }

  // User.ghlContactId does not exist in the current schema.
  // Phase 5 (DispoModal) will add this field. For now, log a warning.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghlContactId = (user as any).ghlContactId as string | undefined;
  if (!ghlContactId) {
    console.warn(
      `[bot-engine] notifyRep: user ${repId} has no ghlContactId — SMS not sent. ` +
      `Add ghlContactId to the User model in Phase 5.`
    );
    return;
  }

  try {
    await sendGhlSms(ghlContactId, message);
  } catch (err) {
    console.error(`[bot-engine] notifyRep SMS failed for user ${repId}:`, err);
  }
}
