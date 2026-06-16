// ── NURTURE HANDLER — LIVE ON THE NEW ENGINE (Sprint 3 cutover) ──────────────
//
// This is the FIRST live route cutover (sprint_3 Step 3). The old nurture
// reply-generation (assembleNurturePrompt + runBot + BotThread.metadata.bot_context)
// is GONE — git is the revert path. Reply generation now runs entirely through the
// shared composed-prompt engine (`runComposedBotTurn`, ARCHITECTURE §4/§5), and
// cross-phase state lives in the `Conversation` record (ARCHITECTURE §7), written
// through the airtight authorship seam (applyModelStateDelta / writeSystemFields).
//
// The GHL plumbing AROUND this is UNCHANGED and reused: the webhook preamble
// (auth/idempotency/opt-out) in the calling routes, `getOrCreateThread` +
// `appendMessage` for the transcript, `sendGhlSms`, `transitionLead`, and the tag
// helpers. (Sprint 9: the QUALIFIED handoff now goes through the server-owned
// Guide→Inspection crossing, `handleGuideQualified`, replacing `routeQualifiedLead`
// + GHL workflow 02's opp-creation.) Only WHAT generates the reply and HOW state is
// stored changed.
//
// This same exported entry point is shared by the dedicated nurture route AND the
// central router, so cutting it over here cuts over both callers at once.

import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  transitionLead,
} from "@/src/lib/bot-engine";
import { handleGuideQualified } from "@/src/lib/bot-v2/guide-crossing";
import { updateSrLead } from "@/src/lib/ghl-custom-object";
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

const PHASE: Phase = "nurture";

// Outward GHL side-effects, injectable for testability (mirrors the engine's
// injectable callClaude seam from Sprint 0). Production callers omit `deps` and
// get the real `sendGhlSms` / `addGhlTag`; the live-route harness injects no-ops
// so it can exercise the full engine + Conversation/BotThread persistence loop
// against the real DB WITHOUT sending a real SMS. This is the only addition to
// the handler's surface — the GHL plumbing itself is unchanged.
export interface NurtureIoDeps {
  sendSms?: (ghlContactId: string, message: string) => Promise<void>;
  addTag?: (ghlContactId: string, tag: string) => Promise<void>;
}

export async function handleNurtureWebhook(
  ctx: {
    lead: Lead;
    srLead: SrLead;
    ghlContactId: string;
    trigger: string;
    inboundMsg: string;
  },
  deps: NurtureIoDeps = {},
): Promise<void> {
  const { lead, srLead, ghlContactId, trigger, inboundMsg } = ctx;
  void srLead; // routing already resolved by the caller; kept for signature parity
  const sendSms = deps.sendSms ?? sendGhlSms;
  const addTag = deps.addTag ?? addGhlTag;

  // ── Classify the turn ──────────────────────────────────────────────────────
  // Only a genuine homeowner SMS is a "real inbound" (it alone resets the heat
  // cooldown clock — ARCHITECTURE §3). new_guide_lead (form submit) is a
  // SYSTEM-initiated opener turn; it does NOT reset the clock.
  //
  // SPRINT 8: the old universal nurture_drip branch is GONE. Re-engagement is now a
  // separate, per-mission, context-driven handler (handleReengageWebhook, trigger=
  // reengage) gated by GHL's guard-tag pattern — not a blind drip in this handler.
  const isRealInbound =
    trigger === "inbound_sms" && !!inboundMsg && inboundMsg !== "new_guide_lead";

  // The single user turn the model answers (history lives in the system prompt —
  // Sprint 2 latest-inbound-only decision). A system opener turn gets a synthetic
  // marker since there is no homeowner message to answer.
  const turnMessage = isRealInbound
    ? inboundMsg
    : `[system: new guide lead — send your source-aware opening message. No prior conversation.]`;

  // ── System-authored source fields → Conversation (app-written, durable) ─────
  // Derived from the Lead each turn (ARCHITECTURE §8: guide → nurture). repName is
  // looked up for rep_door/rep_card so the opener can reference the rep. This also
  // ensures the Conversation row exists and returns the CURRENT (pre-turn) state.
  const rawLead = lead as unknown as Record<string, unknown>;
  const guideSource = (rawLead.guideSource as string | null) ?? null;
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
    { leadId: lead.id, sourceType: "guide", sourceChannel, repName },
    { currentPhase: PHASE, leadId: lead.id },
  );

  // ── Build the turn input ────────────────────────────────────────────────────
  const { id: threadId, messages: priorMessages } = await getOrCreateThread(ghlContactId, "nurture");
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

  // ── Run the engine (tier selection + assembly + repair ladder, all internal) ─
  const result = await runComposedBotTurn(input);
  const sig = result.signal.type;

  // ── Persist model-authored state via the airtight seam ──────────────────────
  await applyModelStateDelta(ghlContactId, result.stateDelta, { currentPhase: PHASE });

  // ── Persist system-authored fields (heat eval + meta) ───────────────────────
  const sysFields: Partial<SystemAuthoredFields> = {
    lastSignal: sig ?? null,
    lastModelTier: result.modelTier,
  };
  // Only a real homeowner inbound resets the cooldown clock (ARCHITECTURE §3).
  if (isRealInbound) sysFields.heatLastInbound = new Date();
  // The MODEL emits the WARMING signal; the SYSTEM owns heatState (Step 4).
  if (sig === "WARMING") {
    sysFields.heatState = "warming";
    sysFields.heatPeakReached = true;
  } else if (result.cooledDown) {
    // Lazy cooldown materialized: warming lead aged past the window → persist cold.
    sysFields.heatState = "cold";
  }
  await writeSystemFields(ghlContactId, sysFields, { currentPhase: PHASE });

  // ── Transcript: append the real inbound (system turns have no real inbound) ──
  if (isRealInbound) await appendMessage(threadId, "user", inboundMsg);

  // ── Reply vs handoff ────────────────────────────────────────────────────────
  // Conversational signals (continue / WARMING / SOFT_CLOSE) send Alex's reply and
  // stay in nurture. Handoff/terminal signals (QUALIFIED / NOT_INTERESTED /
  // ESCALATE) defer to the next bot or a human, so Alex's reply is suppressed —
  // mirrors the old stage_change behavior so we never double-message at handoff.
  const conversational = sig === null || sig === "WARMING" || sig === "SOFT_CLOSE";
  if (conversational && result.reply) {
    await sendSms(ghlContactId, result.reply);
    await appendMessage(threadId, "assistant", result.reply);
  }

  // ── Act on the signal (existing GHL stage/tag plumbing, unchanged) ──────────
  switch (sig) {
    case "QUALIFIED":
      // SPRINT 9 (Part E/G): the server now OWNS the Roof Guide → Inspection crossing
      // (replacing GHL workflow 02's opp-creation). In-area (zip auto-approved) →
      // cross now (purge Guide tags → Guide opp won → Inspection opp at New Lead →
      // qualify). Expansion-zone → HOLD for manual zip review (the pullback already
      // captured commitment; send the service-area string, move to Zip Review). The
      // held lead crosses later on the Zip Confirmed stage entry (zip_confirmed).
      await handleGuideQualified(lead, ghlContactId, { sendSms });
      break;
    case "NOT_INTERESTED":
      await transitionLead(
        lead.id,
        ghlContactId,
        "source_free_guide",
        "sr_dead",
        "DEAD",
        "silent",
        { sr_status: "DEAD", sr_bot_stage: "silent" },
        "NOT_INTERESTED",
      );
      break;
    case "SOFT_CLOSE":
      // SPRINT 8 (Part B5/B7): the server adds the re-engagement GUARD tag on
      // SOFT_CLOSE. GHL's "21. Nurture Re-Engagement" sequence gates every fire on
      // this tag and removes it when the lead replies — the reply-gate the old
      // blind drip lacked. sr_soft_close stays for reporting/segmentation.
      await addTag(ghlContactId, "sr_soft_close").catch((e) => console.error(e));
      await addTag(ghlContactId, "sr_nurture_reengage").catch((e) => console.error(e));
      break;
    case "ESCALATE":
      // Rare in nurture. Existing behavior: park to silent for a human to pick up.
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch(() => null);
      break;
    default:
      break;
  }
}
