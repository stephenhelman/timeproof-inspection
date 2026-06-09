// Sprint 3 — LIVE nurture-route loop test (real engine + real DB, GHL stubbed).
//
//   npm run nurture:live
//
// This is the closest safe proxy for the ngrok round-trip: it drives the ACTUAL
// `handleNurtureWebhook` (the cut-over handler the live route now calls) against
// the REAL database with a throwaway nurture-stage contact, making a REAL live
// Claude call to generate the reply. The ONLY thing stubbed is the outward GHL
// send (injected no-ops capture what WOULD have been sent), so no real SMS goes
// out. It proves the full live loop:
//   - the new engine generates the reply (real model),
//   - the BotThread transcript appends (inbound + reply),
//   - the Conversation model-authored state updates via applyModelStateDelta,
//   - system fields update via writeSystemFields (lastSignal/lastModelTier),
//   - heatLastInbound updates on a real inbound,
//   - a WARMING inbound flips heatState→warming and the NEXT turn selects Sonnet.
//
// Requires ANTHROPIC_API_KEY (real call) and DATABASE access. Exits non-zero on
// any failed assertion. The throwaway rows are deleted at the end.

import { prisma } from "@/src/lib/prisma";
import { handleNurtureWebhook } from "@/src/lib/bot-handlers/nurture";
import { getConversation } from "@/src/lib/conversation";
import type { Lead, SrLead } from "@prisma/client";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
function section(t: string): void { console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`); }

const TEST_CONTACT = `__nurturelive_${process.pid}`;
const TEST_LEAD_ID = `__nurturelive_lead_${process.pid}`;

// Capture what WOULD have been sent to GHL (no real traffic).
const sent: string[] = [];
const tagged: string[] = [];
const stubbedIo = {
  sendSms: async (_id: string, msg: string) => { sent.push(msg); },
  addTag: async (_id: string, tag: string) => { tagged.push(tag); },
};

async function cleanup(): Promise<void> {
  await prisma.conversation.deleteMany({ where: { ghlContactId: TEST_CONTACT } }).catch(() => {});
  await prisma.botThread.deleteMany({ where: { ghlContactId: TEST_CONTACT } }).catch(() => {});
  await prisma.srLead.deleteMany({ where: { leadId: TEST_LEAD_ID } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: TEST_LEAD_ID } }).catch(() => {});
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[nurture:live] ANTHROPIC_API_KEY not set — this test makes a real model call. Aborting.");
    process.exit(2);
  }
  await cleanup();

  // Seed a throwaway nurture-stage lead (guide / rep_door so the opener is warm).
  const lead = (await prisma.lead.create({
    data: {
      id: TEST_LEAD_ID,
      customerName: "Live Route Test",
      streetAddress: "1 Test St",
      city: "El Paso",
      state: "TX",
      zip: "79900",
      sourceZip: "79900",
      ghlContactId: TEST_CONTACT,
      guideSource: "card",
      status: "NEW",
    },
  })) as Lead;
  const srLead = (await prisma.srLead.create({
    data: {
      leadId: TEST_LEAD_ID,
      ghlContactId: TEST_CONTACT,
      srLeadId: "sr_nurturelive",
      srTier: "primary",
      srZone: "z1",
      srStatus: "NEW",
      srQualifyStatus: "pending",
      srBotStage: "nurture",
      srSource: "test",
    },
  })) as SrLead;

  // ── Turn 1: a real INVESTED inbound (should warm + generate a real reply) ───
  section("Turn 1 — real invested inbound through the live handler");
  await handleNurtureWebhook(
    {
      lead, srLead, ghlContactId: TEST_CONTACT, trigger: "inbound_sms",
      inboundMsg: "honestly I've got a couple spots where shingles blew off — is that something I'd catch from the ground or do you have to get up there?",
      dripPosition: null,
    },
    stubbedIo,
  );

  check("a reply was generated + sent (captured, not real SMS)", sent.length === 1, sent);
  check("the reply is non-empty", (sent[0]?.trim().length ?? 0) > 0);

  const thread1 = await prisma.botThread.findUnique({ where: { ghlContactId_botType: { ghlContactId: TEST_CONTACT, botType: "nurture" } } });
  const msgs1 = (thread1?.messages as Array<{ role: string; content: string }>) ?? [];
  check("BotThread appended the inbound (user)", msgs1.some((m) => m.role === "user" && m.content.includes("shingles blew off")), msgs1.map((m) => m.role));
  check("BotThread appended the bot reply (assistant)", msgs1.some((m) => m.role === "assistant"), msgs1.map((m) => m.role));

  const convo1 = await getConversation(TEST_CONTACT);
  check("system field lastModelTier recorded", convo1.lastModelTier === "haiku" || convo1.lastModelTier === "sonnet", convo1.lastModelTier);
  check("system field heatLastInbound set on real inbound", convo1.heatLastInbound !== null);
  check("source fields persisted (sourceType=guide, sourceChannel=rep_card)", convo1.sourceType === "guide" && convo1.sourceChannel === "rep_card", { t: convo1.sourceType, c: convo1.sourceChannel });
  console.log(`  → lastSignal=${convo1.lastSignal}  heatState=${convo1.heatState}  tier=${convo1.lastModelTier}`);
  console.log(`  → reply: ${JSON.stringify(sent[0])}`);

  const warmed = convo1.heatState === "warming";
  check("WARMING inbound flipped heatState→warming (best-effort; informational if model emitted null)", warmed, { heatState: convo1.heatState, lastSignal: convo1.lastSignal });

  // ── Turn 2: confirms the tier flip — a warmed lead's next turn runs on Sonnet ─
  section("Turn 2 — next turn after warming (tier should be Sonnet if warmed)");
  sent.length = 0;
  await handleNurtureWebhook(
    {
      lead, srLead, ghlContactId: TEST_CONTACT, trigger: "inbound_sms",
      inboundMsg: "probably since that windstorm a few weeks back. starting to worry about the next big rain",
      dripPosition: null,
    },
    stubbedIo,
  );
  const convo2 = await getConversation(TEST_CONTACT);
  console.log(`  → turn-2 tier=${convo2.lastModelTier}  heatState=${convo2.heatState}  lastSignal=${convo2.lastSignal}`);
  if (warmed) {
    check("next turn after WARMING selected Sonnet (heat tier flip on the LIVE path)", convo2.lastModelTier === "sonnet", convo2.lastModelTier);
  } else {
    console.log("  [skip] turn-1 did not warm, so no Sonnet flip to assert (WARMING is best-effort).");
  }

  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  await cleanup();
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`[nurture:live] fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  await cleanup().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
