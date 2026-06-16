// Sprint 8 — re-engagement handler test (Part A verify).
//
//   npm run reengage:test
//
// Exercises handleReengageWebhook against the REAL database with throwaway test
// contacts (created fresh, deleted at the end) and a MOCK Claude caller (no live
// model, no SMS). Proves the three Part-A claims:
//   1. A revival lead WITH context (inspectionFindings + sr_dispo_context) →
//      MODEL path: Claude is called, the assembled prompt carries the finding +
//      objection (context-aware), null signal, heatLastInbound UNTOUCHED.
//   2. A cold nurture lead with NO context → TEMPLATE path: Claude is NOT called,
//      a template opener is sent, lastModelTier null, heatLastInbound UNTOUCHED.
//   3. heatLastInbound is never written by a re-engagement (outbound ≠ inbound).
//
// Exit code is non-zero if any assertion fails.

import { prisma } from "@/src/lib/prisma";
import { getConversation, writeSystemFields } from "@/src/lib/conversation";
import { handleReengageWebhook } from "@/src/lib/bot-handlers/reengage";
import type { ClaudeCaller } from "@/src/lib/bot-v2/claude-call";
import type { Lead, SrLead } from "@prisma/client";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
function section(t: string): void {
  console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`);
}

// A valid contract the mock returns so the engine parses cleanly (null signal).
const CANNED_CONTRACT = JSON.stringify({
  reply: "Hey — still thinking about that flashing the inspector flagged? Happy to help whenever.",
  signal: { type: null, confidence: null, reason: null },
  state: { nepqPhase: null, consequenceSurfaced: false, gateProblem: false, gateDecisionMaker: false },
});

// Spy mock: records every call + the systemPrompt it saw, returns the canned contract.
function makeSpyCaller(): { caller: ClaudeCaller; calls: { systemPrompt: string }[] } {
  const calls: { systemPrompt: string }[] = [];
  const caller: ClaudeCaller = async ({ systemPrompt }) => {
    calls.push({ systemPrompt });
    return CANNED_CONTRACT;
  };
  return { caller, calls };
}

const PID = process.pid;
// ── Scenario A — revival lead WITH context ──
const A_CONTACT = `__reengage_revival_${PID}`;
const A_LEAD = `__reengage_revival_lead_${PID}`;
// ── Scenario B — cold nurture lead, NO context ──
const B_CONTACT = `__reengage_nurture_${PID}`;
const B_LEAD = `__reengage_nurture_lead_${PID}`;

const FINDING_TOKEN = "cracked_flashing_east_eave";

async function cleanup(): Promise<void> {
  for (const [c, l] of [[A_CONTACT, A_LEAD], [B_CONTACT, B_LEAD]] as const) {
    await prisma.botThread.deleteMany({ where: { ghlContactId: c } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { ghlContactId: c } }).catch(() => {});
    await prisma.inspection.deleteMany({ where: { leadId: l } }).catch(() => {});
    await prisma.srLead.deleteMany({ where: { leadId: l } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { id: l } }).catch(() => {});
  }
}

async function makeLead(id: string, contact: string): Promise<Lead> {
  return prisma.lead.create({
    data: {
      id, customerName: "Reengage Test", streetAddress: "1 Test St",
      city: "El Paso", state: "TX", zip: "79900", ghlContactId: contact,
    },
  });
}
async function makeSrLead(leadId: string, contact: string, stage: string): Promise<SrLead> {
  return prisma.srLead.create({
    data: {
      leadId, ghlContactId: contact, srLeadId: `sr_${leadId}`, srTier: "primary",
      srZone: "z1", srStatus: "DEMO_NOT_SOLD", srQualifyStatus: "complete",
      srBotStage: stage, srSource: "test",
    },
  }) as Promise<SrLead>;
}

async function main(): Promise<void> {
  await cleanup();

  // ── Scenario A: revival lead with findings + sr_dispo_context ───────────────
  section("A. Revival lead WITH context → MODEL path (context-aware), heat untouched");
  const leadA = await makeLead(A_LEAD, A_CONTACT);
  const srA = await makeSrLead(A_LEAD, A_CONTACT, "revival");
  // Durable inspection findings (the field the active wizard writes — Sprint 7 1b).
  await prisma.inspection.create({
    data: {
      leadId: A_LEAD,
      aiDiagnosisStructured: { primaryConcern: FINDING_TOKEN, overallSeverity: "high" },
    },
  });
  // Conversation in revival with a KNOWN heatLastInbound we will assert is unchanged.
  await getConversation(A_CONTACT, { currentPhase: "revival", leadId: A_LEAD });
  const heatStamp = new Date("2026-01-02T03:04:05.000Z");
  await writeSystemFields(A_CONTACT, { heatLastInbound: heatStamp, heatState: "cold" }, { currentPhase: "revival" });

  const spyA = makeSpyCaller();
  const sentA: string[] = [];
  await handleReengageWebhook(
    { lead: leadA, srLead: srA, ghlContactId: A_CONTACT, mission: "revival", attempt: 1, srDispoContext: "price" },
    { sendSms: async (_c, m) => { sentA.push(m); }, callClaude: spyA.caller },
  );

  check("MODEL was called (real context → generate)", spyA.calls.length === 1, spyA.calls.length);
  check("a re-engagement opener was sent", sentA.length === 1 && (sentA[0]?.length ?? 0) > 0);
  check("prompt carried the inspection finding (context-aware)", spyA.calls[0]?.systemPrompt.includes(FINDING_TOKEN) ?? false);
  check("prompt carried the objection nuance (sr_dispo_context=price)", spyA.calls[0]?.systemPrompt.includes("price") ?? false);
  check("prompt framed it as proactive re-engagement", /re-engagement/i.test(spyA.calls[0]?.systemPrompt ?? ""));

  const convoA = await getConversation(A_CONTACT);
  check("lastSignal is NULL (proactive nudge, nothing to act on)", convoA.lastSignal === null, convoA.lastSignal);
  check("lastModelTier recorded (sonnet for revival)", convoA.lastModelTier === "sonnet", convoA.lastModelTier);
  check("heatLastInbound UNCHANGED (outbound must not reset cooldown)",
    convoA.heatLastInbound?.toISOString() === heatStamp.toISOString(), convoA.heatLastInbound);

  // ── Scenario B: cold nurture lead, no context ──────────────────────────────
  section("B. Cold nurture lead, NO context → TEMPLATE path (no model call), heat untouched");
  const leadB = await makeLead(B_LEAD, B_CONTACT);
  const srB = await makeSrLead(B_LEAD, B_CONTACT, "nurture");
  await getConversation(B_CONTACT, { currentPhase: "nurture", leadId: B_LEAD });
  const heatStampB = new Date("2026-02-03T04:05:06.000Z");
  await writeSystemFields(B_CONTACT, { heatLastInbound: heatStampB, heatState: "cold" }, { currentPhase: "nurture" });

  const spyB = makeSpyCaller();
  const sentB: string[] = [];
  await handleReengageWebhook(
    { lead: leadB, srLead: srB, ghlContactId: B_CONTACT, mission: "nurture", attempt: 1, srDispoContext: null },
    { sendSms: async (_c, m) => { sentB.push(m); }, callClaude: spyB.caller },
  );

  check("MODEL was NOT called (no context → template)", spyB.calls.length === 0, spyB.calls.length);
  check("a template opener was still sent", sentB.length === 1 && (sentB[0]?.length ?? 0) > 0);
  check("the opener is a warm nurture template", /checking back in/i.test(sentB[0] ?? ""), sentB[0]);

  const convoB = await getConversation(B_CONTACT);
  check("lastSignal is NULL", convoB.lastSignal === null, convoB.lastSignal);
  check("lastModelTier is NULL (no model ran)", convoB.lastModelTier === null, convoB.lastModelTier);
  check("heatLastInbound UNCHANGED (template send must not reset cooldown)",
    convoB.heatLastInbound?.toISOString() === heatStampB.toISOString(), convoB.heatLastInbound);

  // ── RESULT ──────────────────────────────────────────────────────────────────
  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  await cleanup();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
