import { prisma } from "@/src/lib/prisma";
import { syncPhaseTransition } from "@/src/lib/conversation";
import { sendGhlSms, addGhlTag, removeGhlTag, notifyManager } from "@/src/lib/ghl-sms";
import { updateSrLead, type SrLeadFields } from "@/src/lib/ghl-custom-object";
import { writeGhlContactCustomField, moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";
import {
  SERVICE_ZONES,
  AVAILABLE_TIMES,
  MAX_INSPECTIONS_PER_DAY_PER_ZONE,
  BOOKING_WINDOW_DAYS,
  SLOT_LOCK_EXPIRY_MINUTES,
  DISTANCE_ZONE_MIN_DAYS_AHEAD,
  getZoneForZip,
  getCompatibleZones,
  getZipTier,
} from "@/src/lib/service-zones";
import {
  TIME_WINDOWS,
  toUnixMs,
  type TimeOfDay,
} from "@/src/lib/time-utils";
import type { Lead, LeadStatus } from "@prisma/client";
import type { BotResponse, BotContext, AreaAppointment } from "@/src/lib/prompts/qntum/types";
import { EMPTY_BOT_CONTEXT } from "@/src/lib/prompts/qntum/types";

// ── Types ──────────────────────────────────────────────────────

export interface BotMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Alex bot utilities ─────────────────────────────────────────

export async function readBotContextFromDb(
  ghlContactId: string
): Promise<BotContext> {
  const thread = await prisma.botThread.findFirst({
    where: { ghlContactId },
    // nulls: 'last' — a freshly-created thread has a null lastMessageAt, which
    // Postgres sorts FIRST under DESC by default (NULLS FIRST). That would return
    // the unstamped thread's empty bot_context and wipe accumulated state. Push
    // nulls last so the read always lands on the most-recently-stamped context.
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } }
  })

  const metadata = thread?.metadata as Record<string, unknown> | null
  const stored = metadata?.bot_context

  if (!stored) return { ...EMPTY_BOT_CONTEXT }

  try {
    return stored as BotContext
  } catch {
    return { ...EMPTY_BOT_CONTEXT }
  }
}

export async function writeBotContextToDb(
  ghlContactId: string,
  botType: string,
  context: BotContext
): Promise<void> {
  const thread = await prisma.botThread.findFirst({
    where: { ghlContactId, botType },
    orderBy: { lastMessageAt: 'desc' }
  })

  if (!thread) {
    console.warn('[bot-engine] writeBotContextToDb: no thread found for', ghlContactId, botType)
    return
  }

  const existingMetadata = (thread.metadata as Record<string, unknown>) ?? {}

  await prisma.botThread.update({
    where: { id: thread.id },
    data: {
      metadata: { ...existingMetadata, bot_context: context } as unknown as never,
      lastMessageAt: new Date()
    }
  })
}

export function formatAppointmentDatetime(slot: string): string {
  console.info('[bot-engine] formatAppointmentDatetime input:', slot, '→ split:', slot.split(' '));
  // Input:  "2026-05-29 17:00"
  // Output: "05-29-2026 5:00 PM"
  const [datePart, timePart] = slot.split(" ");
  const [year, month, day] = datePart.split("-");
  const [hourStr, minute] = timePart.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  console.info('[bot-engine] formatAppointmentDatetime output:', `${month}-${day}-${year} ${hour12}:${minute} ${ampm}`);
  return `${month}-${day}-${year} ${hour12}:${minute} ${ampm}`;
}

function getZipsForZone(zone: string): string[] {
  return SERVICE_ZONES[zone]?.zips ?? [];
}

function extractStreetName(address: string): string {
  // "7370 Mesa Hills Dr, El Paso TX" -> "Mesa Hills Dr"
  const parts = address.split(",")[0].trim().split(" ");
  return parts.slice(1).join(" ");
}

export async function getAreaAppointments(zone: string): Promise<AreaAppointment[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: tomorrow, lte: nextWeek },
      lead: { sourceZip: { in: getZipsForZone(zone) } },
    },
    select: {
      scheduledAt: true,
      lead: { select: { streetAddress: true } },
    },
    take: 5,
  });

  return appointments
    .filter((a) => a.lead?.streetAddress)
    .map((a) => {
      const date = new Date(a.scheduledAt);
      const hour = date.getHours();
      return {
        street: extractStreetName(a.lead!.streetAddress!),
        day: date.toLocaleDateString("en-US", {
          weekday: "long",
          timeZone: "America/Denver",
        }),
        time_of_day: (hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening") as AreaAppointment["time_of_day"],
      };
    });
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

const JSON_FORMAT_INSTRUCTION =
  `\n\nRESPONSE FORMAT — MANDATORY:\n` +
  `Return ONLY a raw JSON object. No markdown. No code fences. No backticks. No prose before or after.\n` +
  `The first character of your response must be { and the last character must be }.\n` +
  `JSON.parse() will be called directly on your response. Any wrapping will cause a failure.`;

async function callClaudeRaw(
  systemPrompt: string,
  messages: BotCallMessage[],
  maxTokens: number,
  jsonMode?: boolean,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const effectiveSystem = jsonMode ? systemPrompt + JSON_FORMAT_INSTRUCTION : systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: effectiveSystem,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[bot-engine] Claude API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { content: { text: string }[] };
  return data.content[0]?.text ?? "";
}

// Callers may include a timestamp field alongside role/content — it is ignored by the API.
export type BotCallMessage = { role: string; content: string; timestamp?: string }

// Overload: JSON mode — returns BotResponse | null
export async function runBot(
  systemPrompt: string,
  messages: BotCallMessage[],
  options: { isJsonMode: true; maxTokens?: number; ghlContactId?: string; previousContext?: BotContext }
): Promise<BotResponse | null>

// Overload: string mode — returns string | null (Jordan-compatible)
export async function runBot(
  systemPrompt: string,
  messages: BotCallMessage[],
  options?: { isJsonMode?: false; maxTokens?: number }
): Promise<string | null>

// Implementation
export async function runBot(
  systemPrompt: string,
  messages: BotCallMessage[],
  options?: { isJsonMode?: boolean; maxTokens?: number; ghlContactId?: string; previousContext?: BotContext }
): Promise<BotResponse | string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[bot-engine] ANTHROPIC_API_KEY not set — bot call skipped");
    if (options?.isJsonMode) return null;
    return "Hey, just wanted to follow up — is now a good time to connect?";
  }

  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  // ── JSON mode: three-attempt retry ──────────────────────────
  if (options?.isJsonMode) {
    const maxTokens = options.maxTokens ?? 600;

    function extractJson(raw: string): string {
      // Strip markdown code fences — ```json ... ``` or ``` ... ```
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) return fenceMatch[1].trim()
      return raw.trim()
    }

    // Attempt 1
    const raw1 = await callClaudeRaw(systemPrompt, apiMessages, maxTokens, true);
    if (raw1 === null) return null;
    try {
      return JSON.parse(extractJson(raw1)) as BotResponse;
    } catch (e) {
      console.warn('[bot-engine] JSON attempt 1 parse failed. Raw response (first 300 chars):', raw1.slice(0, 300));
      // fall through to attempt 2
    }

    // Attempt 2: correct the malformed response
    const retryInstruction =
      `CRITICAL: Your previous response was not valid JSON. Here is what you returned:\n` +
      `<malformed>\n${raw1}\n</malformed>\n\n` +
      `You MUST return only a valid JSON object matching this exact shape:\n` +
      `{\n` +
      `  "bot_context": { "motivation": [], "urgency": false, "decision_makers": false, "time_of_day_preference": null, "appointment_day_preference": null, "appointment_time_preference": null, "address": null, "proximity_angle_used": false, "source_type": null, "rep_name": null, "summary": "" },\n` +
      `  "intent": "nurture",\n` +
      `  "stage_change": false,\n` +
      `  "message": "your message here",\n` +
      `  "signal": null,\n` +
      `  "booked_slot": null\n` +
      `}\n` +
      `Return nothing else. No prose. No markdown. No explanation. Only the JSON object.`;

    const retryMessages = [
      ...apiMessages,
      { role: "assistant", content: raw1 },
      { role: "user", content: retryInstruction },
    ];
    const raw2 = await callClaudeRaw(systemPrompt, retryMessages, maxTokens, true);
    if (raw2 === null) return null;
    try {
      return JSON.parse(extractJson(raw2)) as BotResponse;
    } catch (e) {
      console.warn('[bot-engine] JSON attempt 2 parse failed. Raw response (first 300 chars):', raw2.slice(0, 300));
      // fall through to attempt 3
    }

    // Attempt 3: plain text fallback
    const fallbackSystem =
      "You are Alex, a roofing assistant. Based on this conversation, write one natural response to send to the homeowner. Return only the message text with no formatting or explanation.";
    const raw3 = await callClaudeRaw(fallbackSystem, apiMessages, 200);
    const ghlContactId = options.ghlContactId ?? "unknown";
    console.warn('[bot-engine] JSON fallback used. Attempt 1 raw:', raw1?.slice(0, 200), 'Attempt 2 raw:', raw2?.slice(0, 200));
    console.log(`[bot-engine] JSON fallback used for contact ${ghlContactId}`);
    if (!raw3) return null;
    return {
      bot_context: options.previousContext ?? EMPTY_BOT_CONTEXT,
      intent: "nurture",
      stage_change: false,
      message: raw3.trim(),
      signal: null,
      booked_slot: null,
    } satisfies BotResponse;
  }

  // ── String mode (Jordan-compatible, original behavior) ───────
  const maxTokens = options?.maxTokens ?? 300;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
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
  srLeadUpdates?: Partial<SrLeadFields>,
  // SPRINT 1: the signal that caused this transition, recorded in
  // Conversation.phaseHistory[].exitSignal. Optional/back-compat — null when not
  // applicable or not supplied by an existing caller.
  exitSignal?: string | null,
): Promise<void> {
  // SPRINT 1: the Lead + SrLead stage change and the Conversation phase mirror
  // now move together in ONE interactive transaction (ARCHITECTURE §7) so routing
  // state (srBotStage) and conversation state (currentPhase + phaseHistory) can
  // never diverge. The existing Lead/SrLead behavior is unchanged — SrLead stays
  // best-effort (its catch keeps a missing row from rolling anything back), and
  // the GHL fire-and-forget below is untouched.
  await prisma.$transaction(async (tx) => {
    // 1. Update Lead in DB
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        lastBotType: newBotStage,
        lastBotMessage: new Date(),
      },
    });

    // 2. Update SrLead in DB (best-effort: may not exist for legacy leads). A 0-row
    //    update throws P2025 at the Prisma layer but does NOT abort the Postgres
    //    transaction, so catching here preserves the original best-effort behavior.
    await tx.srLead.update({
      where: { leadId },
      data: {
        srBotStage: newBotStage,
        srStatus: srLeadUpdates?.sr_status ?? (newStatus as string),
        updatedAt: new Date(),
      },
    }).catch(e => console.warn("[bot-engine] srLead.update failed (may not exist):", e));

    // 3. Sync the Conversation phase mirror in the SAME transaction: set
    //    currentPhase (normalized from srBotStage vocab) and append a
    //    phaseHistory entry { phase, enteredAt, exitSignal }.
    await syncPhaseTransition(tx, ghlContactId, newBotStage, exitSignal ?? null, { leadId });
  });

  // 4. GHL updates — parallel, non-blocking. DB is source of truth.
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

// ── Qualified-lead routing ─────────────────────────────────────

// Shared by the nurture handler and the nurture-drip route so the QUALIFIED
// handoff can never diverge between the two paths again (it has been a bug once
// already). Instead of relying on API-added tags — which don't reliably fire GHL
// automations — this moves the Roof Guide opportunity to the correct pipeline
// stage and lets GHL's native stage-change automation drive everything
// downstream (mark won, create the Inspection opp, move to Qualifying, fire the
// qualify bot).
export async function routeQualifiedLead(
  lead: Lead,
  ghlContactId: string,
): Promise<void> {
  if (!lead.sourceZip) {
    console.warn(`[routeQualifiedLead] lead ${lead.id} QUALIFIED with no sourceZip — routing to ZIP review`);
  }
  const tier = lead.sourceZip ? getZipTier(lead.sourceZip) : 'out_of_area';

  // The whole handoff now depends on the stage move, so a null ghlOpportunityId
  // is a hard failure, not a silent skip: there is nothing to move. Log loudly so
  // it's findable, and fall back to the legacy sr_qualifying tag (primary only)
  // as a last-ditch catch GHL automation can react to. Internal notifications are
  // GHL's job, not the server's.
  if (!lead.ghlOpportunityId) {
    console.error(
      `[routeQualifiedLead] lead ${lead.id} QUALIFIED but has no ghlOpportunityId — ` +
      `cannot move pipeline stage; manual handoff required`,
    );

    if (tier === 'primary') {
      // Degraded backstop — let any surviving tag automation try to advance them.
      await addGhlTag(ghlContactId, 'sr_qualifying').catch(() => null);
    } else {
      // Review path — keep the homeowner warm; do NOT advance past review.
      await sendGhlSms(
        ghlContactId,
        "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
      ).catch(() => null);
    }
    return;
  }

  if (tier === 'primary') {
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_GUIDE_QUALIFIED!)
      .catch(err => console.error('[routeQualifiedLead] move→GHL_STAGE_GUIDE_QUALIFIED failed:', err));
  } else {
    // Manager reviews in GHL; on approval they add zip_approved manually, which a
    // separate GHL automation turns into a move to Qualified.
    await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_GUIDE_ZIP_REVIEW!)
      .catch(err => console.error('[routeQualifiedLead] move→GHL_STAGE_GUIDE_ZIP_REVIEW failed:', err));
    await sendGhlSms(
      ghlContactId,
      "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
    ).catch(() => null);
  }
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

// Add `days` to a YYYY-MM-DD calendar-date string and return YYYY-MM-DD.
// Pure calendar math anchored at UTC noon — never round-trips through a
// local/UTC midnight that a timezone conversion could shift to the prior day.
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// UTC ms of 00:00 (midnight) in `timezone` on the given YYYY-MM-DD.
// Midnight-safe: time-utils' toUnixMs(dateStr, 0) day-wraps because at hour 0
// the MT wall-clock falls on the previous calendar day. We instead derive the
// offset off a UTC-noon anchor (safely mid-day in MT) and add it to UTC
// midnight of the same date. Local to getAvailableSlots — toUnixMs is left
// untouched until its other callers are audited.
function mtMidnightUtcMs(dateStr: string, timezone: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const mtHourAtNoon = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
      .formatToParts(new Date(noonUtc))
      .find(p => p.type === 'hour')?.value ?? '12',
    10,
  );
  // MT offset behind UTC (hours) = 12 − (MT hour shown at UTC noon). MDT → 6, MST → 7.
  const offsetHours = 12 - mtHourAtNoon;
  return Date.UTC(y, m - 1, d, 0, 0, 0) + offsetHours * 3600 * 1000;
}

// Parse a GHL slot ISO string (e.g. "2026-06-01T17:00:00-05:00") and return
// the equivalent Mountain Time hour and HH:MM string. Falls back to raw slice
// if the string is not a valid ISO datetime (e.g. plain "09:00:00").
function slotToMountainTime(slotStr: string): { hour: number; timeStr: string } {
  const date = new Date(slotStr);
  if (isNaN(date.getTime())) {
    // Plain time string like "09:00:00" or "09:00" — assume already MT
    const timeStr = slotStr.slice(0, 5);
    const hour = parseInt(timeStr.split(':')[0], 10);
    return { hour, timeStr };
  }
  const mtStr = date.toLocaleString('en-US', {
    timeZone: process.env.BOT_TIMEZONE ?? 'America/Denver',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hour, minute] = mtStr.split(':').map(Number);
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  return { hour, timeStr };
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
      const slots: string[] = Array.isArray(val)
        ? val
        : val?.slots && Array.isArray(val.slots)
          ? val.slots
          : [];
      if (slots.length > 0) {
        // Convert each slot to Mountain Time — handles ISO strings like "2026-06-01T17:00:00-05:00"
        result[date] = slots.map((t: string) => slotToMountainTime(t).timeStr);
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

  const nowMs = Date.now();

  // "Today" as a calendar date in the booking timezone — NOT the server's
  // local/UTC midnight. GHL keys its free-slots response in the timezone we
  // request, so every date key we build must be derived in that same timezone,
  // otherwise the lookup misses and we silently fall back to AVAILABLE_TIMES.
  const todayMT = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  // Local zones allow same-day (day 0) — the past-slot guard below drops any
  // already-passed times. Distance zones keep their configured lead-time so the
  // inspector can plan the drive/route to far areas.
  const minDaysAhead = isDistance ? Math.max(DISTANCE_ZONE_MIN_DAYS_AHEAD, 1) : 0;

  // GHL fetch window, as UTC instants aligned to MT calendar-day boundaries.
  const windowStartMs = mtMidnightUtcMs(addDaysToDateStr(todayMT, minDaysAhead), timezone);
  const windowEndMs   = mtMidnightUtcMs(addDaysToDateStr(todayMT, BOOKING_WINDOW_DAYS + 1), timezone);

  console.log("[bot-engine] getAvailableSlots:", {
    leadZone, isDistance, timePreference, startHour, endHour, todayMT,
    windowStart: new Date(windowStartMs).toISOString(), windowEnd: new Date(windowEndMs).toISOString(),
    startMs: windowStartMs, endMs: windowEndMs,
  });

  const [ghlSlots, existingLocks] = await Promise.all([
    fetchGhlFreeSlots(windowStartMs, windowEndMs),
    prisma.slotLock.findMany({
      where: { expiresAt: { gt: new Date() } },
    }),
  ]);

  const compatibleZones = getCompatibleZones(leadZone);
  const allCompatible = new Set([leadZone, ...compatibleZones]);

  const results: Array<{ date: string; time: string; label: string }> = [];

  for (let d = minDaysAhead; d <= BOOKING_WINDOW_DAYS && results.length < 3; d++) {
    // MT calendar date — used for GHL slot key lookup, lock date comparison, and returned slot data.
    // GHL returns slot keys in the timezone we requested (America/Denver), so we must match that.
    const ghlDateKey = addDaysToDateStr(todayMT, d);
    const [yy, mm, dd] = ghlDateKey.split('-').map(Number);

    // Filter out Sunday — calendar marked unavailable (use UTC noon so the
    // weekday is read off the calendar date, not a timezone-shifted instant).
    const dayOfWeek = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0)).getUTCDay();
    if (dayOfWeek === 0) continue;

    // UTC-midnight bounds of the calendar date — matches how SlotLock.date is
    // stored (local-midnight of the date) and how appointment days are queried.
    const dayStart = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(yy, mm - 1, dd, 23, 59, 59, 999));

    // Load confirmed appointments for this day to check zone conflicts + count
    const dayAppointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd } },
      include: { lead: { select: { sourceZip: true } } },
    });

    // Build zone list for confirmed appointments this day
    const inspZones = dayAppointments
      .map((a) => a.lead?.sourceZip ? getZoneForZip(a.lead.sourceZip) : null)
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

    const ghlAvail = new Set(ghlSlots[ghlDateKey] ?? AVAILABLE_TIMES);

    for (const time of AVAILABLE_TIMES) {
      if (results.length >= 3) break;

      // Filter to requested time window
      const slotHour = parseInt(time.split(":")[0], 10);
      if (slotHour < startHour || slotHour >= endHour) continue;

      // Never offer a slot in the past. Load-bearing now that local zones allow
      // same-day (day 0): this drops today's already-passed times, leaving only
      // the remaining slots later today. (Uses a business hour, never 0, so the
      // toUnixMs midnight wrap doesn't apply here.)
      if (toUnixMs(ghlDateKey, slotHour) <= nowMs) continue;

      // Check 1: GHL calendar free
      if (Object.keys(ghlSlots).length > 0 && !ghlAvail.has(time)) continue;

      // Check 2: no exact SlotLock on this date+time (compare against MT date key)
      const exactLock = existingLocks.find(
        (l) => l.date.toISOString().slice(0, 10) === ghlDateKey && l.time === time
      );
      if (exactLock) continue;

      results.push({
        date: ghlDateKey,
        time,
        label: formatDateLabel(ghlDateKey, time, timezone),
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

  const newAppointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: dayStart, lte: dayEnd },
      createdAt: { gt: lock.createdAt },
    },
    include: { lead: { select: { sourceZip: true } } },
  });

  const compatibleZones = new Set([zone, ...getCompatibleZones(zone)]);
  const conflict = newAppointments.some((a) => {
    const z = a.lead?.sourceZip ? getZoneForZip(a.lead.sourceZip) : null;
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
  if (slotLabel?.trim() && process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME) {
    console.info('[bot-engine] confirmBooking: writing sr_appointment_datetime', { ghlContactId, slotLabel });
    await writeGhlContactCustomField(
      ghlContactId,
      process.env.GHL_FIELD_SR_APPOINTMENT_DATETIME,
      slotLabel,
    ).catch(err =>
      console.error('[bot-engine] confirmBooking: sr_appointment_datetime write failed for contact', ghlContactId, 'label:', slotLabel, err)
    );
  }

  // 2. Update lead status
  await prisma.lead.update({
    where: { id: leadId },
    data:  { status: 'INSPECTION_SCHEDULED' },
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
