// ── QUALIFY HANDLER — LIVE ON THE NEW ENGINE (Sprint 4 cutover) ──────────────
//
// The second live route cutover (sprint_4 Step 5), same pattern as the Sprint 3
// nurture cutover. The old qualify reply-generation (assembleQualifyPrompt +
// runBot + BotThread.metadata.bot_context + the hardcoded QUALIFY_OPENER) is GONE
// — git is the revert path. Reply generation now runs entirely through the shared
// composed-prompt engine (`runComposedBotTurn`, ARCHITECTURE §4/§5) on the
// qualify mission (Sonnet — the three gates get surfaced here), and cross-phase
// state lives in the `Conversation` record (ARCHITECTURE §7), written through the
// airtight authorship seam (applyModelStateDelta / writeSystemFields).
//
// The GHL plumbing AROUND this is UNCHANGED and reused: webhook preamble (in the
// calling routes), getOrCreateThread + appendMessage for the transcript,
// sendGhlSms, transitionLead, and the tag/stage helpers. Only WHAT generates the
// reply and HOW state is stored changed.

import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  transitionLead,
  isCancellation,
} from "@/src/lib/bot-engine";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
import { moveGhlOpportunityStage } from "@/src/lib/ghl-contacts";
import {
  writeSystemFields,
  applyModelStateDelta,
  conversationToStateInput,
  type SystemAuthoredFields,
} from "@/src/lib/conversation";
import { runComposedBotTurn } from "@/src/lib/bot-v2/engine";
import type { Phase, TurnInput } from "@/src/lib/bot-v2/types";
import type { Lead, SrLead } from "@prisma/client";

type BotMessage = { role: string; content: string; timestamp: string };

const PHASE: Phase = "qualify";

// Outward GHL side-effects, injectable for testability (mirrors the nurture
// handler's seam). Production callers omit `deps`; the live-route harness injects
// no-ops so it can exercise the full engine + Conversation/BotThread persistence
// loop against the real DB WITHOUT sending a real SMS.
export interface QualifyIoDeps {
  sendSms?: (ghlContactId: string, message: string) => Promise<void>;
  addTag?: (ghlContactId: string, tag: string) => Promise<void>;
  removeTag?: (ghlContactId: string, tag: string) => Promise<void>;
}

export async function handleQualifyWebhook(
  ctx: {
    lead: Lead;
    srLead: SrLead;
    ghlContactId: string;
    trigger: string;
    inboundMsg: string;
  },
  deps: QualifyIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;
  void srLead; // routing already resolved by the caller; kept for signature parity
  const sendSms = deps.sendSms ?? sendGhlSms;
  const addTag = deps.addTag ?? addGhlTag;
  const removeTag = deps.removeTag ?? removeGhlTag;
  const rawLead = lead as unknown as Record<string, unknown>;

  // ── Cancellation (existing behavior, unchanged) ─────────────────────────────
  if (trigger === "inbound_sms" && isCancellation(inboundMsg)) {
    const activeInspection = await prisma.inspection.findFirst({
      where: { leadId: lead.id, status: "scheduled" },
    });
    if (activeInspection) {
      await prisma.inspection.update({
        where: { id: activeInspection.id },
        data: { status: "cancelled", repNotes: "Cancelled by homeowner via SMS" },
      });
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_cancelled", "DEMO_NOT_SOLD", "silent", {
        sr_status: "DEMO_NOT_SOLD", sr_bot_stage: "silent",
      });
      const fn = lead.customerName.trim().split(/\s+/)[0];
      await sendSms(ghlContactId, `No problem, ${fn}. We'll remove you from the schedule. If you ever want to revisit, just reach out.`);
      return;
    }
  }

  // ── Classify the turn ───────────────────────────────────────────────────────
  // A genuine homeowner SMS is the only "real inbound" (it alone resets the heat
  // cooldown clock — ARCHITECTURE §3). The opener triggers (new_inspection_lead /
  // scheduling_approved) are SYSTEM-initiated: the model still produces a message
  // (its source-aware opener), but there is no homeowner message to answer.
  const isRealInbound =
    trigger === "inbound_sms" && !!inboundMsg && inboundMsg !== "new_lead";

  let turnMessage: string;
  if (isRealInbound) {
    turnMessage = inboundMsg;
  } else {
    // new_inspection_lead / scheduling_approved / first-contact → source-aware opener.
    turnMessage =
      `[system: new qualify lead — send your source-aware opening message. ` +
      `No prior conversation. Read sourceType/funnelConcerns and open accordingly.]`;
  }

  // ── System-authored source fields → Conversation (app-written, durable) ─────
  // ARCHITECTURE §8 routing: a lead with a guide source is a warmed nurture lead
  // (sourceType "guide"); otherwise this is a direct inspection requester who
  // entered qualify on Sonnet (sourceType "inspection"). Warm a guide lead's
  // sourceChannel from guideSource; an inspection lead is "organic". repName is
  // looked up for rep_door/rep_card. Also ensures the Conversation row exists and
  // returns the CURRENT (pre-turn) state.
  const guideSource = (rawLead.guideSource as string | null) ?? null;
  const sourceType = guideSource ? "guide" : "inspection";
  const sourceChannel =
    guideSource === "door" ? "rep_door" : guideSource === "card" ? "rep_card" : "organic";

  let repName: string | null = null;
  if ((guideSource === "door" || guideSource === "card") && lead.assignedUserId) {
    const user = await prisma.user.findUnique({
      where: { id: lead.assignedUserId },
      select: { name: true },
    });
    repName = user?.name ?? null;
  }

  const convo = await writeSystemFields(
    ghlContactId,
    { leadId: lead.id, sourceType, sourceChannel, repName },
    { currentPhase: PHASE, leadId: lead.id },
  );

  // ── Build the turn input ────────────────────────────────────────────────────
  const { id: threadId, messages: priorMessages } = await getOrCreateThread(ghlContactId, "qualify");
  const history = (priorMessages as BotMessage[]).map((m) => ({
    role: (m.role === "assistant" ? "bot" : "lead") as "bot" | "lead",
    content: m.content,
    timestamp: m.timestamp,
  }));

  const input: TurnInput = {
    ghlContactId,
    inboundMessage: turnMessage,
    conversationState: conversationToStateInput(convo),
    conversationHistory: history,
    phase: PHASE,
  };

  // ── Run the engine (tier selection → Sonnet, assembly, repair ladder) ───────
  const result = await runComposedBotTurn(input);
  const sig = result.signal.type;

  // ── Persist model-authored state via the airtight seam ──────────────────────
  await applyModelStateDelta(ghlContactId, result.stateDelta, { currentPhase: PHASE });

  // ── Persist system-authored fields (meta + heat clock) ──────────────────────
  const sysFields: Partial<SystemAuthoredFields> = {
    lastSignal: sig ?? null,
    lastModelTier: result.modelTier,
  };
  if (isRealInbound) sysFields.heatLastInbound = new Date();
  await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE });

  // ── Transcript: append the real inbound (opener turns have no real inbound) ──
  if (isRealInbound) await appendMessage(threadId, "user", inboundMsg);

  // ── Reply vs handoff ────────────────────────────────────────────────────────
  // Conversational signals (continue / SOFT_CLOSE) send Alex's reply and stay in
  // qualify. Handoff/terminal signals defer downstream: QUALIFIED hands to the
  // book bot (which sends its own opener), NOT_INTERESTED closes — both suppress
  // Alex's reply so we never double-message at handoff. ESCALATE sends Alex's
  // closing message (so the homeowner isn't left hanging) then parks for a human.
  const sendReply = sig === null || sig === "SOFT_CLOSE" || sig === "ESCALATE";
  if (sendReply && result.reply) {
    await sendSms(ghlContactId, result.reply);
    await appendMessage(threadId, "assistant", result.reply);
  }

  // ── Act on the signal (existing GHL stage/tag plumbing, unchanged) ──────────
  switch (sig) {
    case "QUALIFIED": {
      // Three gates confirmed → advance to BOOKING. transitionLead moves the
      // SrLead stage AND syncs Conversation.currentPhase→book + appends a
      // phaseHistory entry with exitSignal QUALIFIED, atomically. The
      // model-authored summary already lives on the Conversation row (persisted
      // above), so Book inherits the surfaced problem+consequence with no re-ask.
      if (!lead.ghlOpportunityId) {
        console.warn(`[qualify] lead ${lead.id} QUALIFIED with no ghlOpportunityId — pipeline stage move skipped`);
      }
      await transitionLead(
        lead.id,
        ghlContactId,
        "sr_qualifying",
        "sr_booking",
        lead.status,
        "booking",
        { sr_bot_stage: "booking", sr_qualify_status: "qualified" },
        "QUALIFIED",
      );
      await addTag(ghlContactId, "sr_qualified").catch((e) => console.error(e));
      if (lead.ghlOpportunityId) {
        await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_BOOKING!).catch((err) =>
          console.error("[qualify] moveGhlOpportunityStage BOOKING failed", err),
        );
      }
      // GHL's stage-change automation fires the qualified_handoff webhook → the
      // book bot sends its own opener.
      break;
    }
    case "NOT_INTERESTED":
      await transitionLead(lead.id, ghlContactId, "sr_qualifying", "sr_dead", "DEAD", "silent", {
        sr_status: "DEAD", sr_bot_stage: "silent",
      }, "NOT_INTERESTED");
      if (lead.ghlOpportunityId) {
        await moveGhlOpportunityStage(lead.ghlOpportunityId, process.env.GHL_STAGE_DEAD!).catch((e) => console.error(e));
      }
      break;
    case "SOFT_CLOSE":
      await addTag(ghlContactId, "sr_soft_close").catch((e) => console.error(e));
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      break;
    case "ESCALATE":
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      await addTag(ghlContactId, "sr_escalation").catch(() => null);
      break;
    default:
      break;
  }

  void removeTag; // reserved for parity with other handlers; tags moved via transitionLead

  // SPRINT 5: Jordan's revival/reschedule/finance plug into this same loop.
}
