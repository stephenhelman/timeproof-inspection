import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isCancellation,
  purgeExpiredSlotLocks,
  getAvailableSlots,
  createSlotLock,
  validateSlotBeforeConfirm,
  confirmBooking,
  notifyRep,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import {
  getGhlContactCustomField,
  moveGhlOpportunityStage,
  writeGhlOpportunityCustomField,
  updateGhlContact,
} from "@/src/lib/ghl-contacts";
import { assembleBookPrompt } from "@/src/lib/prompts/qntum/assemblers/book";
import {
  detectTimePreference,
  type TimeOfDay,
} from "@/src/lib/time-utils";
import {
  getZoneForZip,
  isDistanceZone,
} from "@/src/lib/service-zones";
import type {
  BookContext,
  BookLastMessageContext,
} from "@/src/lib/prompts/qntum/types";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

function stripAnySignals(text: string): string {
  return text.replace(/\[[A-Z_:0-9 .-]+\]/g, "").trim();
}

function detectBookLastMessageContext(message: string): BookLastMessageContext {
  if (!message) return "none";
  const t = message.toLowerCase().trim();
  if (/speak (to|with) (someone|a person|manager)|call me|want a human/.test(t))
    return "escalation_needed";
  if (/check (with|my)|need to (ask|check)|not sure (yet|about)/.test(t))
    return "stall";
  if (
    /^(yes|yeah|yep|sure|confirmed|that works|perfect|ok|okay|sounds good)\.?$/.test(
      t,
    ) ||
    /that work|confirmed|book it/.test(t)
  )
    return "confirmed";
  if (
    /can('t| not)|won't work|not (available|good)|different (time|day)/.test(t)
  )
    return "slot_rejected";
  return "none";
}

function looksLikeAddress(message: string): boolean {
  const hasNumber     = /\d+/.test(message);
  const hasStreetWord = /\b(st|ave|blvd|ln|dr|rd|way|ct|pl|street|avenue|lane|drive|road|boulevard|court|place)\b/i.test(message);
  const hasCity       = /el paso|las cruces|alamogordo/i.test(message);
  const isLongEnough  = message.trim().length > 8;
  return isLongEnough && ((hasNumber && hasStreetWord) || (hasNumber && hasCity));
}

async function handleStallExhaustedWebhook(
  lead: Lead,
  ghlContactId: string,
): Promise<void> {
  await updateSrLead(lead.id, {
    sr_bot_stage: "revival",
    sr_status:    "DEMO_NOT_SOLD",
  });
  if (lead.ghlOpportunityId) {
    await moveGhlOpportunityStage(
      lead.ghlOpportunityId,
      process.env.GHL_STAGE_FOLLOW_UP_ACTIVE!,
    ).catch((err) =>
      console.error("[book/stall_exhausted] moveStage failed:", err),
    );
  }
  await Promise.allSettled([
    addGhlTag(ghlContactId, "sr_follow_up"),
    removeGhlTag(ghlContactId, "booking_stall"),
  ]);
}

async function handleAppointmentConfirmedWebhook(
  lead: Lead,
  ghlContactId: string,
): Promise<void> {
  const assignedUserId =
    lead.assignedUserId ?? process.env.GHL_DEFAULT_ASSIGNEE_ID ?? null;

  const inspectionAddress =
    lead.address ??
    [
      (lead as unknown as Record<string, unknown>).streetAddress as string | null,
      lead.city,
      lead.state,
    ]
      .filter(Boolean)
      .join(", ") ??
    "";

  const inspection = await prisma.inspection.create({
    data: {
      userId:        assignedUserId,
      leadId:        lead.id,
      customerName:  lead.customerName,
      address:       inspectionAddress,
      phone:         lead.phone ?? null,
      appointmentAt: lead.appointmentDate ?? new Date(),
      status:        "scheduled",
    },
  });

  if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_INSPECTION_ID) {
    await writeGhlOpportunityCustomField(
      lead.ghlOpportunityId,
      process.env.GHL_FIELD_OPP_SR_INSPECTION_ID,
      inspection.id,
    ).catch((err) =>
      console.error("[book/appt_confirmed] writeGhlOpportunityCustomField inspection_id failed:", err),
    );
  }

  if (lead.ghlOpportunityId && process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT) {
    const contextLine = `inspection_id:${inspection.id} created:${new Date().toISOString()}`;
    await writeGhlOpportunityCustomField(
      lead.ghlOpportunityId,
      process.env.GHL_FIELD_OPP_SR_PIPELINE_CONTEXT,
      contextLine,
    ).catch((err) =>
      console.error("[book/appt_confirmed] writeGhlOpportunityCustomField pipeline_context failed:", err),
    );
  }

  console.log(
    `[book/appt_confirmed] inspection created: ${inspection.id} for lead ${lead.id}`,
  );

  void ghlContactId; // not needed here; kept for signature symmetry with stall handler
}

export async function handleBookWebhook(ctx: {
  lead: Lead;
  srLead: SrLead;
  ghlContactId: string;
  trigger: string;
  inboundMsg: string;
}): Promise<void> {
  const { lead, ghlContactId, trigger, inboundMsg } = ctx;

  // ── Named trigger dispatch ─────────────────────────────────────────────────
  if (trigger === "stall_exhausted") {
    await handleStallExhaustedWebhook(lead, ghlContactId);
    return;
  }

  if (trigger === "appointment_confirmed") {
    await handleAppointmentConfirmedWebhook(lead, ghlContactId);
    return;
  }

  // ── Cancellation check ────────────────────────────────────────────────────
  if (trigger === "inbound_sms" && isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: "scheduled" },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: "cancelled", repNotes: "Cancelled via SMS" },
      });
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_booking",
        "sr_cancelled",
        "DEMO_NOT_SOLD",
        "silent",
        { sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent" },
      );
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendGhlSms(
        ghlContactId,
        `No problem, ${fn}. We've cancelled your inspection. If things change, reach out anytime.`,
      );
      return;
    }
  }

  // ── Book bot conversation ─────────────────────────────────────────────────
  await purgeExpiredSlotLocks();

  const leadZone = lead.sourceZip
    ? (getZoneForZip(lead.sourceZip) ?? null)
    : null;
  const distanceZone = leadZone ? isDistanceZone(leadZone) : false;
  const zone = leadZone ?? "el_paso_central";

  // Address collection
  const rawLead = lead as unknown as Record<string, unknown>;
  const existingAddress = (rawLead.address as string | null) ?? null;
  let addressCollected     = !!(existingAddress && existingAddress.trim().length > 0);
  let confirmedAddress     = existingAddress;
  let justCollectedAddress = false;

  if (
    !addressCollected &&
    trigger === "inbound_sms" &&
    inboundMsg &&
    looksLikeAddress(inboundMsg)
  ) {
    const trimmedAddr = inboundMsg.trim();
    await prisma.lead.update({
      where: { id: lead.id },
      data:  { address: trimmedAddr },
    });
    if (lead.ghlContactId) {
      await updateGhlContact(lead.ghlContactId, { address1: trimmedAddr }).catch(
        (err) => console.error("[book] updateGhlContact address failed:", err),
      );
    }
    confirmedAddress     = trimmedAddr;
    addressCollected     = true;
    justCollectedAddress = true;
    console.log("[book] address collected for lead:", lead.id, trimmedAddr);
  }

  // Read qualify bot context written on [QUALIFIED]
  const previousBotContext = process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT
    ? await getGhlContactCustomField(
        ghlContactId,
        process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT,
      ).catch((err) => {
        console.warn(
          "[book] getGhlContactCustomField previousBotContext failed for contact",
          ghlContactId,
          err,
        );
        return null;
      })
    : null;

  const contextTimePreference =
    previousBotContext?.match(/Time preference: "([^"]+)"/)?.[1] ?? null;
  const contextConfirmedIssue =
    previousBotContext?.match(/Confirmed issue: "([^"]+)"/)?.[1] ?? null;

  // Time preference detection — current message first, context fallback, then 'any'
  let timePreference: TimeOfDay = "any";
  let specificStartHour: number | undefined;
  if (trigger === "inbound_sms" && inboundMsg) {
    const detected = detectTimePreference(inboundMsg);
    if (detected) {
      timePreference    = detected.preference;
      specificStartHour = detected.startHour;
    }
  }
  if (timePreference === "any" && contextTimePreference) {
    const ctxDetected = detectTimePreference(contextTimePreference);
    if (ctxDetected) {
      timePreference    = ctxDetected.preference;
      specificStartHour = ctxDetected.startHour;
    }
  }

  // Slot fetching — only after address is collected
  const existingLock = await prisma.slotLock.findUnique({
    where: { leadId: lead.id },
  });

  let rawSlots: Array<{ date: string; time: string; label: string }> = [];
  if (
    addressCollected &&
    (!existingLock ||
      trigger === "qualified_handoff" ||
      trigger === "stall_followup")
  ) {
    rawSlots = await getAvailableSlots(
      zone,
      distanceZone,
      timePreference,
      specificStartHour,
    );
    if (rawSlots.length > 0) {
      const [y, m, d] = rawSlots[0].date.split("-").map(Number);
      await createSlotLock({
        date:   new Date(y, m - 1, d),
        time:   rawSlots[0].time,
        zone,
        leadId: lead.id,
        label:  rawSlots[0].label || rawSlots[0].time,
      });
    }
  } else if (addressCollected && existingLock) {
    rawSlots = [];
  }

  const { id: threadId, messages } = await getOrCreateThread(
    ghlContactId,
    "book",
  );

  type Trigger = BookContext["trigger"];
  const triggerMap: Record<string, Trigger> = {
    qualified_handoff: "qualified_handoff",
    stall_followup:    "stall_followup",
  };
  const bookTrigger: Trigger = triggerMap[trigger] ?? "inbound_sms";

  const knownIssues = Array.isArray(lead.knownIssues)
    ? (lead.knownIssues as string[])
    : [];
  const activeIssues = knownIssues.filter(
    (i) => i !== "I haven't noticed anything",
  );

  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  const currentMessages = (thread?.messages as BotMessage[]) ?? [];
  const lastUserMsg = [...currentMessages].reverse().find(
    (m) => m.role === "user",
  );

  const lockedSlot = existingLock
    ? {
        date:  existingLock.date?.toISOString().slice(0, 10) ?? "",
        time:  existingLock.time ?? "",
        label: existingLock.label ?? rawSlots[0]?.label ?? "",
      }
    : rawSlots[0]
      ? {
          date:  rawSlots[0].date,
          time:  rawSlots[0].time,
          label: rawSlots[0].label,
        }
      : null;

  const context: BookContext = {
    bot_type:              "book",
    homeowner_name:        lead.customerName,
    first_name:            lead.customerName.trim().split(/\s+/)[0],
    source_zip:            lead.sourceZip ?? "",
    zone:                  leadZone ?? "",
    message_history_count: currentMessages.length,
    last_message_context:  justCollectedAddress
      ? "address_provided"
      : detectBookLastMessageContext(lastUserMsg?.content ?? inboundMsg),
    available_slots: rawSlots.map((s) => ({
      date:       s.date,
      time:       s.time,
      label:      s.label,
      zone_label: zone,
    })),
    locked_slot: lockedSlot,
    qualify_summary: {
      problem_confirmed:        activeIssues.length > 0,
      specific_issue:           contextConfirmedIssue ?? activeIssues[0]?.toLowerCase() ?? null,
      roof_age:                 lead.roofAge ?? null,
      decision_maker_confirmed: lead.decisionMakerHome === "Yes",
    },
    trigger:             bookTrigger,
    address_collected:   addressCollected,
    confirmed_address:   confirmedAddress,
    time_preference:     timePreference,
    specific_start_hour: specificStartHour,
    previousBotContext:  previousBotContext ?? undefined,
  };

  const systemPrompt = assembleBookPrompt(context);

  if (bookTrigger === "qualified_handoff") {
    // qualify bot transitional message already asked for address
    // Do not send an opener. Wait for homeowner's address reply.
    console.info("[book] qualified_handoff received — skipping opener, waiting for address reply");
    return;
  }

  if (inboundMsg && !["qualified_handoff", "stall_followup"].includes(trigger)) {
    await appendMessage(threadId, "user", inboundMsg);
  }

  if (bookTrigger === "stall_followup") {
    const stalledThread = await prisma.botThread.findUnique({
      where: { id: threadId },
    });
    const stalledMessages = (stalledThread?.messages as BotMessage[]) ?? [];
    const stalledBotMessages = stalledMessages.map((m) => ({
      role:      m.role as "user" | "assistant",
      content:   m.content,
      timestamp: m.timestamp,
    }));
    stalledBotMessages.push({
      role:      "user",
      content:   "stall_followup",
      timestamp: new Date().toISOString(),
    });
    const rawResponse = await runBot(systemPrompt, stalledBotMessages);
    if (rawResponse === null) {
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
        console.error("[book/stall] updateSrLead silent failed", err),
      );
      return;
    }
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
    await appendMessage(threadId, "assistant", rawResponse);
    if (rawResponse.includes("[STALL]")) {
      await addGhlTag(ghlContactId, "booking_stall_exhausted");
      await addGhlTag(ghlContactId, "sr_follow_up");
    }
    return;
  }

  const reloadedThread = await prisma.botThread.findUnique({
    where: { id: threadId },
  });
  const reloadedMessages = (reloadedThread?.messages as BotMessage[]) ?? [];
  const botMessages = reloadedMessages.map((m) => ({
    role:      m.role as "user" | "assistant",
    content:   m.content,
    timestamp: m.timestamp,
  }));
  const rawResponse = await runBot(systemPrompt, botMessages);
  if (rawResponse === null) {
    await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
      console.error("[book] updateSrLead silent failed", err),
    );
    return;
  }

  // ── [CHECK_MORE_SLOTS] ─────────────────────────────────────────────────────
  const checkSlotsMatch = rawResponse.match(
    /\[CHECK_MORE_SLOTS(?::\s*(\d{2}:\d{2}))?\]/,
  );
  if (checkSlotsMatch) {
    let retryPreference: TimeOfDay = timePreference;
    let retryStartHour: number | undefined = specificStartHour;
    const timeStr = checkSlotsMatch[1];
    if (timeStr) {
      retryStartHour = parseInt(timeStr.split(":")[0], 10);
      if (retryStartHour < 12)      retryPreference = "morning";
      else if (retryStartHour < 17) retryPreference = "afternoon";
      else                          retryPreference = "evening";
    }
    const freshSlots = await getAvailableSlots(
      zone,
      distanceZone,
      retryPreference,
      retryStartHour,
    );
    if (freshSlots.length > 0) {
      const [fy, fm, fd] = freshSlots[0].date.split("-").map(Number);
      await createSlotLock({
        date:   new Date(fy, fm - 1, fd),
        time:   freshSlots[0].time,
        zone,
        leadId: lead.id,
        label:  freshSlots[0].label || freshSlots[0].time,
      });
    }
    const freshContext: BookContext = {
      ...context,
      available_slots: freshSlots.map((s) => ({
        date:       s.date,
        time:       s.time,
        label:      s.label,
        zone_label: zone,
      })),
      locked_slot: freshSlots[0]
        ? { date: freshSlots[0].date, time: freshSlots[0].time, label: freshSlots[0].label }
        : null,
      time_preference:     retryPreference,
      specific_start_hour: retryStartHour,
    };
    const retryResponse = await runBot(
      assembleBookPrompt(freshContext),
      botMessages,
    );
    if (retryResponse !== null) {
      if (retryResponse.includes("[STALL]")) {
        await addGhlTag(ghlContactId, "booking_stall");
      }
      await sendGhlSms(ghlContactId, stripAnySignals(retryResponse));
      await appendMessage(threadId, "assistant", retryResponse);
    }
    return;
  }

  // ── [BOOKED] ───────────────────────────────────────────────────────────────
  const bookedMatch = rawResponse.match(
    /\[BOOKED:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]/,
  );

  if (bookedMatch) {
    const [, dateStr, timePart] = bookedMatch;
    const [year, month, day]    = dateStr.split("-").map(Number);
    const [hour, minute]        = timePart.split(":").map(Number);

    // Convert MT wall-clock time to UTC for DB storage
    const _tz    = process.env.BOT_TIMEZONE ?? "America/Denver";
    const _guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const _off   = ((): number => {
      const pts = new Intl.DateTimeFormat("en-US", {
        timeZone: _tz, hour: "numeric", minute: "2-digit", hour12: false,
      }).formatToParts(_guess);
      const h = parseInt(pts.find((p) => p.type === "hour")?.value   ?? "0", 10);
      const m = parseInt(pts.find((p) => p.type === "minute")?.value ?? "0", 10);
      return h * 60 + m - (hour * 60 + minute);
    })();
    const date = new Date(_guess.getTime() - _off * 60 * 1000);

    const slotLabel = context.locked_slot?.label?.trim()
      ? context.locked_slot.label
      : `${dateStr} at ${timePart}`;

    const validation = await validateSlotBeforeConfirm(
      lead.id,
      date,
      timePart,
      zone,
    );

    if (!validation.ok) {
      console.warn("[book] slot conflict on confirm:", validation.reason);
      const freshSlots = await getAvailableSlots(
        zone,
        distanceZone,
        timePreference,
        specificStartHour,
      );
      if (freshSlots.length > 0) {
        const [fy, fm, fd] = freshSlots[0].date.split("-").map(Number);
        await createSlotLock({
          date:   new Date(fy, fm - 1, fd),
          time:   freshSlots[0].time,
          zone,
          leadId: lead.id,
          label:  freshSlots[0].label || freshSlots[0].time,
        });
      }
      return;
    }

    try {
      await confirmBooking(
        lead.id,
        ghlContactId,
        date,
        slotLabel,
        confirmedAddress ?? undefined,
      );
    } catch (err) {
      console.error("[book] confirmBooking failed:", err);
      const freshSlots = await getAvailableSlots(
        zone,
        distanceZone,
        timePreference,
        specificStartHour,
      );
      if (freshSlots.length > 0) {
        const [fy, fm, fd] = freshSlots[0].date.split("-").map(Number);
        await createSlotLock({
          date:   new Date(fy, fm - 1, fd),
          time:   freshSlots[0].time,
          zone,
          leadId: lead.id,
          label:  freshSlots[0].label || freshSlots[0].time,
        });
      }
      return;
    }

    await transitionLead(
      lead.id,
      ghlContactId,
      "sr_booking",
      "sr_appointment_set",
      "INSPECTION_SCHEDULED",
      "silent",
      {
        sr_status:         "INSPECTION_SCHEDULED",
        sr_appointment_at: date.toISOString(),
        sr_bot_stage:      "silent",
      },
    );

    if (lead.ghlOpportunityId) {
      await moveGhlOpportunityStage(
        lead.ghlOpportunityId,
        process.env.GHL_STAGE_APPOINTMENT_SET!,
      ).catch((err) =>
        console.error("[book] moveStage APPOINTMENT_SET failed:", err),
      );
    }

    const confirmMsg =
      `You're all set — got you down for ${slotLabel}. ` +
      `Our inspector will reach out the morning of with a heads up. See you then!`;
    await sendGhlSms(ghlContactId, confirmMsg);

    if (lead.assignedUserId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.scopereports.com";
      const repMsg =
        `New inspection booked!\n\n` +
        `Homeowner: ${lead.customerName}\n` +
        `Address:   ${confirmedAddress ?? "not provided"}\n` +
        `Date/Time: ${slotLabel}\n` +
        `Phone:     ${lead.phone ?? "not on file"}\n\n` +
        `${appUrl}/leads/${lead.id}`;
      await notifyRep(lead.assignedUserId, lead.id, repMsg).catch((err) =>
        console.error("[book] notifyRep failed:", err),
      );
    }
  } else {
    if (rawResponse.includes("[STALL]")) {
      await addGhlTag(ghlContactId, "booking_stall");
    }
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
  }

  await appendMessage(threadId, "assistant", rawResponse);
}
