import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead, type SrLeadFields } from "@/src/lib/ghl-custom-object";
import { writeGhlContactCustomField } from "@/src/lib/ghl-contacts";
import {
  SERVICE_ZONES,
  AVAILABLE_TIMES,
  MAX_INSPECTIONS_PER_DAY_PER_ZONE,
  BOOKING_WINDOW_DAYS,
  SLOT_LOCK_EXPIRY_MINUTES,
  DISTANCE_ZONE_MIN_DAYS_AHEAD,
  getZoneForZip,
  getCompatibleZones,
} from "@/src/lib/service-zones";
import {
  TIME_WINDOWS,
  type TimeOfDay,
} from "@/src/lib/time-utils";
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

function formatDateLabel(dateStr: string, time: string, timezone: string): string {
  // Parse the datetime as a Mountain Time wall-clock value so the formatter
  // never double-converts. We find the UTC instant that equals dateStr+time in
  // the given timezone by formatting a candidate UTC date and iterating once.
  const [hour, minute] = time.split(":").map(Number);
  const [year, month, day] = dateStr.split("-").map(Number);

  // Build a UTC Date that represents this wall-clock time in `timezone`.
  // Strategy: guess UTC = wall-clock time, check what MT that is, then correct.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const tzOffset = ((): number => {
    // Format guess as a UTC-offset time in the target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(guess);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    // Offset = displayed MT time minus intended time (in minutes)
    return h * 60 + m - (hour * 60 + minute);
  })();
  const dt = new Date(guess.getTime() - tzOffset * 60 * 1000);

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
  startMs: number,
  endMs: number
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
    // GHL v2 calendar API requires UNIX timestamps in milliseconds
    url.searchParams.set("startDate", String(startMs));
    url.searchParams.set("endDate", String(endMs));
    url.searchParams.set("timezone", timezone);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-04-15",
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[bot-engine] GHL calendar API ${res.status}:`, errBody, "url:", url.toString());
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    console.log("[bot-engine] fetchGhlFreeSlots response:", JSON.stringify(data).slice(0, 500));

    // GHL v2 may return _dates_ or slots key; values may be array or { slots: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: Record<string, any> = data?._dates_ ?? data?.slots ?? {};
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
  leadZone:          string,
  isDistance:        boolean,
  timePreference:    TimeOfDay = 'any',
  specificStartHour?: number   // overrides window.startHour (e.g. "after 2" → 14)
): Promise<Array<{ date: string; time: string; label: string }>> {
  const timezone  = process.env.BOT_TIMEZONE ?? "America/Denver";
  const window    = TIME_WINDOWS[timePreference];
  const startHour = specificStartHour ?? window.startHour;
  const endHour   = window.endHour;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Always start from tomorrow — never offer same-day slots
  const minDaysAhead = isDistance ? Math.max(DISTANCE_ZONE_MIN_DAYS_AHEAD, 1) : 1;
  const windowStart  = addDays(today, minDaysAhead);
  const windowEnd    = addDays(today, BOOKING_WINDOW_DAYS);

  console.log("[bot-engine] getAvailableSlots:", {
    leadZone, isDistance, timePreference, startHour, endHour,
    windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(),
    startMs: windowStart.getTime(), endMs: windowEnd.getTime(),
  });

  const [ghlSlots, existingLocks] = await Promise.all([
    fetchGhlFreeSlots(windowStart.getTime(), windowEnd.getTime()),
    prisma.slotLock.findMany({
      where: { expiresAt: { gt: new Date() } },
    }),
  ]);

  const compatibleZones = getCompatibleZones(leadZone);
  const allCompatible = new Set([leadZone, ...compatibleZones]);

  const results: Array<{ date: string; time: string; label: string }> = [];

  for (let d = minDaysAhead; d <= BOOKING_WINDOW_DAYS && results.length < 3; d++) {
    const dayDate = addDays(today, d);

    const dateStr = dayDate.toISOString().slice(0, 10);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

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

      // Filter to requested time window
      const slotHour = parseInt(time.split(":")[0], 10);
      if (slotHour < startHour || slotHour >= endHour) continue;

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
        label: formatDateLabel(dateStr, time, timezone),
      });
    }
  }

  console.log("[bot-engine] getAvailableSlots returning:", results);
  return results;
}

export async function createSlotLock(args: {
  date:   Date;
  time:   string;
  zone:   string;
  leadId: string;
  label?: string; // verbatim slot label — stored for use in confirmation SMS
}): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SLOT_LOCK_EXPIRY_MINUTES * 60 * 1000
  );
  await prisma.slotLock.upsert({
    where:  { leadId: args.leadId },
    update: { date: args.date, time: args.time, zone: args.zone, label: args.label ?? null, expiresAt },
    create: { date: args.date, time: args.time, zone: args.zone, label: args.label ?? null, leadId: args.leadId, expiresAt },
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
  leadId:       string,
  ghlContactId: string,
  datetime:     Date,
  slotLabel:    string,  // verbatim label — written to sr_appointment_datetime field
  address?:     string,  // kept for call-site compatibility; address stored separately
): Promise<void> {
  void address; // not used after calendar/inspection creation was extracted to appointment_confirmed webhook

  // 1. Write appointment label to GHL contact field — triggers appointment_confirmed workflow
  if (slotLabel && process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME) {
    await writeGhlContactCustomField(
      ghlContactId,
      process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME,
      slotLabel,
    ).catch(err =>
      console.error('[bot-engine] confirmBooking: writeGhlContactCustomField failed:', err)
    );
  }

  // 2. Update lead status
  await prisma.lead.update({
    where: { id: leadId },
    data:  { status: 'INSPECTION_SCHEDULED', appointmentDate: datetime },
  });

  // 3. Delete the SlotLock
  await prisma.slotLock.deleteMany({ where: { leadId } }).catch(err =>
    console.error('[bot-engine] SlotLock cleanup failed:', err)
  );
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
