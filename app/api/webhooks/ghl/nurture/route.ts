// ── DEDICATED NURTURE WEBHOOK ROUTE ──────────────────────────────────────────
// Triggers: new_guide_lead, nurture_drip, inbound_sms (srBotStage === 'nurture')
//
// Handler logic mirrors central/route.ts handleNurtureWebhook verbatim.
// Additions vs central:
//   - customData payload parsing
//   - SrLead load + opt-out gate
//   - sr_previous_context write to GHL on [INSPECTION_INTENT]
//   - Transitional SMS generation (max_tokens 100) before qualify activation
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/src/lib/prisma";
import { sendGhlSms, addGhlTag, removeGhlTag } from "@/src/lib/ghl-sms";
import {
  getOrCreateThread,
  appendMessage,
  runBot,
  transitionLead,
  isOptOut,
} from "@/src/lib/bot-engine";
import {
  validateWebhookSecret,
  loadLead,
  isDuplicate,
  logWebhookHit,
} from "@/src/lib/bot-webhook-utils";
import { getSrLeadFromDb, updateSrLead } from "@/src/lib/ghl-custom-object";
import { writeGhlContactCustomField } from "@/src/lib/ghl-contacts";
import { assembleNurturePrompt } from "@/src/lib/prompts/qntum/assemblers/nurture";
import type {
  NurtureContext,
  NurtureLastMessageContext,
} from "@/src/lib/prompts/qntum/types";

type BotMessage = { role: string; content: string; timestamp: string };

function stripAnySignals(text: string): string {
  return text.replace(/\[[A-Z_:0-9 .-]+\]/g, "").trim();
}

function detectNurtureLastMessageContext(
  message: string,
): NurtureLastMessageContext {
  if (!message || message === "new_guide_lead") return "none";
  const t = message.toLowerCase();
  if (
    /not interested|leave me alone|stop texting|don't (want|need)|no thanks/.test(
      t,
    )
  )
    return "not_interested";
  if (
    /when (could|can) you (come|get) out|schedule|book|inspection|worried|concerned/.test(
      t,
    )
  )
    return "intent_signal";
  if (/leak|missing|crack|damage|hail|stain|sagging|rot/.test(t))
    return "problem_mentioned";
  if (/looks fine|no issues|don't think|not sure|just curious/.test(t))
    return "no_problem_aware";
  if (/not really|don't know|maybe|i guess/.test(t)) return "skeptical";
  if (message.trim().length < 10) return "stalling";
  return "curious_engaged";
}

async function getUsedInsightIds(threadId: string): Promise<string[]> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return [];
  const meta = thread.metadata as Record<string, unknown> | null;
  return Array.isArray(meta?.usedInsightIds)
    ? (meta.usedInsightIds as string[])
    : [];
}

async function addUsedInsightId(
  threadId: string,
  insightId: string,
): Promise<void> {
  const thread = await prisma.botThread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  const meta = (thread.metadata as Record<string, unknown>) ?? {};
  const existing = Array.isArray(meta.usedInsightIds)
    ? (meta.usedInsightIds as string[])
    : [];
  if (!existing.includes(insightId)) {
    await prisma.botThread.update({
      where: { id: threadId },
      data: { metadata: { ...meta, usedInsightIds: [...existing, insightId] } },
    });
  }
}

// Short bridging SMS generated right before qualify activation.
// Keeps max_tokens low — we just need a one-liner handoff message.
async function generateTransitionalSms(firstName: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system:
          "You are Alex, a friendly texting rep for a roofing company. " +
          "Write one short SMS (under 25 words) that naturally bridges a homeowner from a general roofing conversation into a scheduling handoff. " +
          "Use their first name. Sound warm and conversational. No emojis. Return only the SMS text.",
        messages: [
          {
            role: "user",
            content: `Homeowner first name: ${firstName}. Write the transition SMS.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    return (data?.content?.[0]?.text ?? "").trim() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  const rawBody = await request.json().catch(() => null);
  const data = rawBody?.customData ?? rawBody ?? {};
  const ghlContactId: string | null = data.contact_id ?? data.contactId ?? null;
  const trigger: string = data.trigger ?? "inbound_sms";
  const inboundMsg: string = data.message ?? "";
  const dripPosition: number | null = data.drip_position
    ? parseInt(data.drip_position)
    : null;

  if (!ghlContactId) {
    console.error(
      "[nurture] no contact_id in payload",
      JSON.stringify(rawBody).slice(0, 500),
    );
    return new Response("OK", { status: 200 });
  }

  const idempotencyKey =
    trigger === "inbound_sms"
      ? createHash("sha256")
          .update(`${ghlContactId}:inbound:${inboundMsg}`)
          .digest("hex")
      : createHash("sha256")
          .update(`${ghlContactId}:${trigger}:${Date.now()}`)
          .digest("hex");

  if (await isDuplicate(idempotencyKey)) {
    return new Response("OK", { status: 200 });
  }

  const lead = await loadLead(ghlContactId);
  if (!lead) {
    console.warn("[nurture] no lead for contact", ghlContactId);
    await logWebhookHit({
      source: "ghl_bot_nurture",
      payload: rawBody,
      success: false,
      error: "lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  const srLead = await getSrLeadFromDb(lead.id, ghlContactId);
  if (!srLead) {
    console.warn("[nurture] no SrLead for lead", lead.id);
    await logWebhookHit({
      source: "ghl_bot_nurture",
      payload: rawBody,
      success: false,
      error: "sr_lead_not_found",
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  if (srLead.srOptedOut || lead.botOptedOut) {
    return new Response("OK", { status: 200 });
  }

  if (trigger === "inbound_sms" && isOptOut(inboundMsg)) {
    await addGhlTag(ghlContactId, "sr_opted_out").catch((e) =>
      console.error(e),
    );
    await transitionLead(
      lead.id,
      ghlContactId,
      null,
      "sr_dead",
      "DEAD",
      "silent",
      { sr_status: "DEAD", sr_bot_stage: "silent", sr_opted_out: true },
    );
    await prisma.lead.update({
      where: { id: lead.id },
      data: { botOptedOut: true },
    });
    await logWebhookHit({
      source: "ghl_bot_nurture",
      payload: rawBody,
      success: true,
      leadId: lead.id,
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  try {
    const rawLead = lead as unknown as Record<string, unknown>;
    const issuesNoticed =
      ((rawLead.issuesNoticed as string | null) ?? null)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? null;
    const sourceRaw =
      (rawLead.guideSource as string) ??
      (rawLead.source as string) ??
      "organic";
    const srcMap: Record<string, NurtureContext["source"]> = {
      "facebook-guide": "facebook-guide",
      door: "door",
      card: "card",
      organic: "organic",
    };
    const source: NurtureContext["source"] = srcMap[sourceRaw] ?? "organic";

    const {
      id: threadId,
      messages,
      isNew,
    } = await getOrCreateThread(ghlContactId, "nurture");
    const usedInsightIds = await getUsedInsightIds(threadId);

    // ── nurture_drip branch ────────────────────────────────────────────────────
    if (trigger === "nurture_drip" && dripPosition !== null) {
      const pos = dripPosition as 1 | 2 | 3 | 4;
      const thread = await prisma.botThread.findUnique({
        where: { id: threadId },
      });
      const currentMessages = (thread?.messages as BotMessage[]) ?? [];

      const context: NurtureContext = {
        bot_type: "nurture",
        homeowner_name: lead.customerName,
        first_name: lead.customerName.trim().split(/\s+/)[0],
        source,
        rep: (rawLead.rep as string | null) ?? null,
        message_history_count: currentMessages.length,
        last_message_context: "none",
        roof_type: (rawLead.roofType as string | null) ?? null,
        roof_age: lead.roofAge ?? null,
        issues_noticed: issuesNoticed,
        last_inspected: lead.lastInspected ?? null,
        address: lead.streetAddress ?? null,
        used_insight_ids: usedInsightIds,
        is_drip: true,
        drip_sequence_position: pos,
      };
      const systemPrompt = assembleNurturePrompt(context);
      const botMessages = [
        ...currentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.timestamp,
        })),
        {
          role: "user" as const,
          content: "[drip_trigger]",
          timestamp: new Date().toISOString(),
        },
      ];
      const rawResponse = await runBot(systemPrompt, botMessages);
      if (rawResponse === null) {
        await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
          console.error("[nurture/drip] updateSrLead silent failed", err),
        );
        await logWebhookHit({
          source: "ghl_bot_nurture",
          payload: rawBody,
          success: true,
          leadId: lead.id,
          idempotencyKey,
        });
        return new Response("OK", { status: 200 });
      }

      const insightUsed =
        rawResponse
          .match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]
          ?.toLowerCase() ?? null;
      await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
      await appendMessage(threadId, "assistant", rawResponse);
      if (insightUsed) await addUsedInsightId(threadId, insightUsed);

      if (rawResponse.includes("[INSPECTION_INTENT]")) {
        // Use tier stored at lead creation — do not re-evaluate ZIP.
        const tier = srLead.srTier ?? lead.sourceTier ?? "out_of_area";
        const lastAssistantMsg = stripAnySignals(rawResponse);
        if (lastAssistantMsg && process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
          await writeGhlContactCustomField(
            ghlContactId,
            process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT,
            lastAssistantMsg,
          ).catch((err) =>
            console.error(
              "[nurture/drip] writeGhlContactCustomField failed:",
              err,
            ),
          );
        }
        await addGhlTag(ghlContactId, "zip_check_pending");
        if (tier === "primary") {
          const transitional = await generateTransitionalSms(
            lead.customerName.trim().split(/\s+/)[0],
          );
          if (transitional) await sendGhlSms(ghlContactId, transitional);
          await removeGhlTag(ghlContactId, "zip_check_pending");
          await addGhlTag(ghlContactId, "zip_approved");
          await addGhlTag(ghlContactId, "sr_qualifying");
        } else {
          await removeGhlTag(ghlContactId, "zip_check_pending");
          await addGhlTag(ghlContactId, "zip_review_pending");
          await sendGhlSms(
            ghlContactId,
            "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
          );
        }
      } else if (rawResponse.includes("[NOT_INTERESTED]")) {
        await transitionLead(
          lead.id,
          ghlContactId,
          "source_free_guide",
          "sr_dead",
          "DEAD",
          "silent",
          { sr_status: "DEAD", sr_bot_stage: "silent" },
        );
      } else if (rawResponse.includes("[SOFT_CLOSE]") || pos === 4) {
        await addGhlTag(ghlContactId, "sr_nurture_exhausted");
      }

      await logWebhookHit({
        source: "ghl_bot_nurture",
        payload: rawBody,
        success: true,
        leadId: lead.id,
        idempotencyKey,
      });
      return new Response("OK", { status: 200 });
    }

    // ── new_guide_lead / inbound_sms branch ───────────────────────────────────

    if (inboundMsg && inboundMsg !== "new_guide_lead") {
      await appendMessage(threadId, "user", inboundMsg);
    }

    const thread = await prisma.botThread.findUnique({
      where: { id: threadId },
    });
    const currentMessages = (thread?.messages as BotMessage[]) ?? [];

    const context: NurtureContext = {
      bot_type: "nurture",
      homeowner_name: lead.customerName,
      first_name: lead.customerName.trim().split(/\s+/)[0],
      source,
      rep: (rawLead.rep as string | null) ?? null,
      message_history_count: currentMessages.length,
      last_message_context: detectNurtureLastMessageContext(inboundMsg),
      roof_type: (rawLead.roofType as string | null) ?? null,
      roof_age: lead.roofAge ?? null,
      issues_noticed: issuesNoticed,
      last_inspected: lead.lastInspected ?? null,
      address: lead.streetAddress ?? null,
      used_insight_ids: usedInsightIds,
      is_drip: false,
      drip_sequence_position: null,
    };

    if (isNew || messages.length === 0) {
      const systemPrompt = assembleNurturePrompt(context);
      const openerRaw = await runBot(systemPrompt, [
        {
          role: "user",
          content: "new_guide_lead",
          timestamp: new Date().toISOString(),
        },
      ]);
      if (openerRaw !== null) {
        const insightUsed =
          openerRaw
            .match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]
            ?.toLowerCase() ?? null;
        await sendGhlSms(ghlContactId, stripAnySignals(openerRaw));
        await appendMessage(threadId, "assistant", openerRaw);
        if (insightUsed) await addUsedInsightId(threadId, insightUsed);
      }
      if (!inboundMsg || inboundMsg === "new_guide_lead") {
        await logWebhookHit({
          source: "ghl_bot_nurture",
          payload: rawBody,
          success: true,
          leadId: lead.id,
          idempotencyKey,
        });
        return new Response("OK", { status: 200 });
      }
    }

    const freshThread = await prisma.botThread.findUnique({
      where: { id: threadId },
    });
    const freshMessages = (freshThread?.messages as BotMessage[]) ?? [];
    const freshContext: NurtureContext = {
      ...context,
      message_history_count: freshMessages.length,
      used_insight_ids: await getUsedInsightIds(threadId),
    };
    const systemPrompt = assembleNurturePrompt(freshContext);
    const botMessages = freshMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    const rawResponse = await runBot(systemPrompt, botMessages);
    if (rawResponse === null) {
      await updateSrLead(lead.id, { sr_bot_stage: "silent" }).catch((err) =>
        console.error("[nurture] updateSrLead silent failed", err),
      );
      await logWebhookHit({
        source: "ghl_bot_nurture",
        payload: rawBody,
        success: true,
        leadId: lead.id,
        idempotencyKey,
      });
      return new Response("OK", { status: 200 });
    }

    const insightUsed =
      rawResponse
        .match(/\[INSIGHT_USED:\s*([a-z_]+)\]/i)?.[1]
        ?.toLowerCase() ?? null;
    await sendGhlSms(ghlContactId, stripAnySignals(rawResponse));
    await appendMessage(threadId, "assistant", rawResponse);
    if (insightUsed) await addUsedInsightId(threadId, insightUsed);

    if (rawResponse.includes("[INSPECTION_INTENT]")) {
      // Use tier stored at lead creation — do not re-evaluate ZIP.
      const tier = srLead.srTier ?? lead.sourceTier ?? "out_of_area";
      const lastAssistantMsg = stripAnySignals(rawResponse);
      if (lastAssistantMsg && process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT) {
        await writeGhlContactCustomField(
          ghlContactId,
          process.env.GHL_FIELD_SR_PREVIOUS_CONTEXT,
          lastAssistantMsg,
        ).catch((err) =>
          console.error("[nurture] writeGhlContactCustomField failed:", err),
        );
      }
      await addGhlTag(ghlContactId, "zip_check_pending");
      if (tier === "primary") {
        const transitional = await generateTransitionalSms(
          lead.customerName.trim().split(/\s+/)[0],
        );
        if (transitional) await sendGhlSms(ghlContactId, transitional);
        await removeGhlTag(ghlContactId, "zip_check_pending");
        await addGhlTag(ghlContactId, "zip_approved");
        await addGhlTag(ghlContactId, "sr_qualifying");
      } else {
        await removeGhlTag(ghlContactId, "zip_check_pending");
        await addGhlTag(ghlContactId, "zip_review_pending");
        await sendGhlSms(
          ghlContactId,
          "To make sure we can help, I want to loop in my team real quick. I'll get back to you shortly.",
        );
      }
    } else if (rawResponse.includes("[NOT_INTERESTED]")) {
      await transitionLead(
        lead.id,
        ghlContactId,
        "source_free_guide",
        "sr_dead",
        "DEAD",
        "silent",
        { sr_status: "DEAD", sr_bot_stage: "silent" },
      );
    } else if (rawResponse.includes("[SOFT_CLOSE]")) {
      await addGhlTag(ghlContactId, "sr_soft_close");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[nurture] uncaught error:", message);
    await logWebhookHit({
      source: "ghl_bot_nurture",
      payload: rawBody,
      success: false,
      error: message,
      leadId: lead.id,
      idempotencyKey,
    });
    return new Response("OK", { status: 200 });
  }

  await logWebhookHit({
    source: "ghl_bot_nurture",
    payload: rawBody,
    success: true,
    leadId: lead.id,
    idempotencyKey,
  });
  return new Response("OK", { status: 200 });
}
