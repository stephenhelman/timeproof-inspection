// Sprint 4 — LIVE full-Alex-arc route test (real engine + real DB, GHL stubbed).
//
//   npm run alex:live
//
// The closest safe proxy for the ngrok round-trip across Alex's WHOLE front
// funnel: it drives the ACTUAL live handlers (handleNurtureWebhook →
// handleQualifyWebhook → handleBookWebhook) against the REAL database with a
// throwaway contact, making REAL live Claude calls. The ONLY things stubbed are
// the outward GHL send/tag and the BOOKED confirm path (injected via deps), so no
// real SMS goes out and no real GHL/DB booking confirm runs. It proves the arc:
//
//   warmed nurture → (handoff) → QUALIFIED (Sonnet, 3 gates) → stage move →
//   book (Haiku) → slots pre-fetched + injected → BOOKED handoff to confirm path.
//
// Requires ANTHROPIC_API_KEY (real calls) and DATABASE access. Because the model
// is real (non-deterministic), the conversation is scripted with strong inbounds
// and the terminal-signal steps loop a few times; structural invariants (tiers,
// persistence, slot pre-fetch, phase advance, BOOKED handoff) are asserted hard.
// Throwaway rows are deleted at the end.

import { prisma } from "@/src/lib/prisma";
import { handleNurtureWebhook } from "@/src/lib/bot-handlers/nurture";
import { handleQualifyWebhook } from "@/src/lib/bot-handlers/qualify";
import { handleBookWebhook } from "@/src/lib/bot-handlers/book";
import { getConversation } from "@/src/lib/conversation";
import { transitionLead } from "@/src/lib/bot-engine";
import type { Lead, SrLead } from "@prisma/client";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
function section(t: string): void { console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`); }

const TEST_CONTACT = `__alexarc_${process.pid}`;
const TEST_LEAD_ID = `__alexarc_lead_${process.pid}`;

// Capture all outward effects (no real GHL traffic, no real confirm).
const sent: string[] = [];
const tagged: string[] = [];
const bookedConfirms: { slot: string; address: string | null; summary: string | null }[] = [];

const ioDeps = {
  sendSms: async (_id: string, msg: string) => { sent.push(msg); },
  addTag: async (_id: string, tag: string) => { tagged.push(tag); },
  removeTag: async (_id: string, _tag: string) => {},
};
const bookDeps = {
  ...ioDeps,
  confirmBooked: async (a: { slot: string; address: string | null; summary: string | null }) => {
    bookedConfirms.push({ slot: a.slot, address: a.address, summary: a.summary });
  },
};

async function cleanup(): Promise<void> {
  await prisma.slotLock.deleteMany({ where: { leadId: TEST_LEAD_ID } }).catch(() => {});
  await prisma.conversation.deleteMany({ where: { ghlContactId: TEST_CONTACT } }).catch(() => {});
  await prisma.botThread.deleteMany({ where: { ghlContactId: TEST_CONTACT } }).catch(() => {});
  await prisma.srLead.deleteMany({ where: { leadId: TEST_LEAD_ID } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: TEST_LEAD_ID } }).catch(() => {});
}

function lastReply(): string { return sent[sent.length - 1] ?? "(none)"; }

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[alex:live] ANTHROPIC_API_KEY not set — this test makes real model calls. Aborting.");
    process.exit(2);
  }
  await cleanup();

  // Inspection-source lead so qualify enters warm on Sonnet. (A warmed nurture
  // lead would arrive the same way after the nurture→qualify handoff; we exercise
  // a real nurture turn first, then hand off.)
  const lead = (await prisma.lead.create({
    data: {
      id: TEST_LEAD_ID,
      customerName: "Arc Test",
      streetAddress: "1 Test St",
      city: "El Paso",
      state: "TX",
      zip: "79912",
      sourceZip: "79912",
      ghlContactId: TEST_CONTACT,
      guideSource: "door",
      status: "NEW",
    },
  })) as Lead;
  const srLead = (await prisma.srLead.create({
    data: {
      leadId: TEST_LEAD_ID,
      ghlContactId: TEST_CONTACT,
      srLeadId: "sr_alexarc",
      srTier: "primary",
      srZone: "z1",
      srStatus: "NEW",
      srQualifyStatus: "pending",
      srBotStage: "nurture",
      srSource: "test",
    },
  })) as SrLead;

  // ── 1. NURTURE — a real invested inbound (warming) ─────────────────────────
  section("1. NURTURE — invested inbound through the live handler");
  await handleNurtureWebhook(
    { lead, srLead, ghlContactId: TEST_CONTACT, trigger: "inbound_sms",
      inboundMsg: "a couple spots where shingles blew off after that windstorm — is that something I'd catch from the ground or do you have to get up there?",
      dripPosition: null },
    ioDeps,
  );
  const cNurture = await getConversation(TEST_CONTACT);
  check("nurture produced a reply", sent.length >= 1, lastReply());
  check("nurture recorded a tier", cNurture.lastModelTier === "haiku" || cNurture.lastModelTier === "sonnet", cNurture.lastModelTier);
  console.log(`  → nurture lastSignal=${cNurture.lastSignal} heatState=${cNurture.heatState} tier=${cNurture.lastModelTier}`);
  console.log(`  → reply: ${JSON.stringify(lastReply())}`);

  // ── 2. HANDOFF — simulate GHL moving the lead to the qualify stage ─────────
  section("2. HANDOFF — transition to qualifying (simulates GHL stage automation)");
  await transitionLead(TEST_LEAD_ID, TEST_CONTACT, "sr_nurture", "sr_qualifying", "NEW", "qualifying", { sr_bot_stage: "qualifying" }, "WARMING");
  const cAfterHandoff = await getConversation(TEST_CONTACT);
  check("currentPhase synced to qualify", cAfterHandoff.currentPhase === "qualify", cAfterHandoff.currentPhase);

  // ── 3. QUALIFY — drive the three gates (Sonnet) ─────────────────────────────
  section("3. QUALIFY — scripted gates → QUALIFIED (Sonnet)");
  const qualifyScript = [
    "there's a brown stain spreading across my back bedroom ceiling and it keeps getting bigger",
    "honestly I'm worried it's already getting into the framing and turns into a massive repair bill if I keep waiting",
    "it's just me and my wife — we talked it over last night and we both want to get it looked at as soon as possible",
    "yes please, let's get it on the calendar",
  ];
  let qualified = false;
  for (let i = 0; i < qualifyScript.length && !qualified; i++) {
    sent.length = 0;
    await handleQualifyWebhook(
      { lead, srLead, ghlContactId: TEST_CONTACT, trigger: "inbound_sms", inboundMsg: qualifyScript[i] },
      ioDeps,
    );
    const c = await getConversation(TEST_CONTACT);
    console.log(`  q-turn ${i + 1}: tier=${c.lastModelTier} signal=${c.lastSignal} phase=${c.currentPhase} gates(P/C/D)=${c.gateProblem}/${c.consequenceSurfaced}/${c.gateDecisionMaker}`);
    console.log(`     reply: ${JSON.stringify(lastReply())}`);
    check(`qualify turn ${i + 1} ran on Sonnet`, c.lastModelTier === "sonnet", c.lastModelTier);
    if (c.lastSignal === "QUALIFIED" || c.currentPhase === "book") { qualified = true; }
  }
  const cQualified = await getConversation(TEST_CONTACT);
  const srAfterQ = await prisma.srLead.findUnique({ where: { leadId: TEST_LEAD_ID } });
  check("QUALIFIED reached → stage moved to booking", srAfterQ?.srBotStage === "booking", srAfterQ?.srBotStage);
  check("currentPhase advanced to book", cQualified.currentPhase === "book", cQualified.currentPhase);
  check("summary carried forward (problem filled)", !!(cQualified.summary as { problem?: string } | null)?.problem, cQualified.summary);

  // ── 4. BOOK — opener, address, slot pick → BOOKED (Haiku) ──────────────────
  section("4. BOOK — qualified_handoff opener → address → slot pick → BOOKED (Haiku)");
  sent.length = 0;
  await handleBookWebhook({ lead, srLead, ghlContactId: TEST_CONTACT, trigger: "qualified_handoff", inboundMsg: "" }, bookDeps);
  let cBook = await getConversation(TEST_CONTACT);
  check("book opener ran on Haiku", cBook.lastModelTier === "haiku", cBook.lastModelTier);
  console.log(`  → book opener: ${JSON.stringify(lastReply())}`);

  const bookScript = [
    "sure — it's 4820 Mesa Hills Dr, El Paso TX 79912",
    "the earliest time you have works great for me",
    "yes that one, let's lock it in",
  ];
  let booked = false;
  let slotLockSeenAfterAddress = false;
  for (let i = 0; i < bookScript.length && !booked; i++) {
    sent.length = 0;
    await handleBookWebhook({ lead, srLead, ghlContactId: TEST_CONTACT, trigger: "inbound_sms", inboundMsg: bookScript[i] }, bookDeps);
    cBook = await getConversation(TEST_CONTACT);
    const lock = await prisma.slotLock.findUnique({ where: { leadId: TEST_LEAD_ID } });
    if (cBook.address || lead.address) {
      // Once an address is known, the handler pre-fetches slots and locks the
      // first one — the proof that slot pre-fetch-and-inject ran.
      if (lock) slotLockSeenAfterAddress = true;
    }
    console.log(`  b-turn ${i + 1}: tier=${cBook.lastModelTier} signal=${cBook.lastSignal} address=${JSON.stringify(cBook.address)} slotLock=${lock ? `${lock.date.toISOString().slice(0, 10)} ${lock.time}` : "none"}`);
    console.log(`     reply: ${JSON.stringify(lastReply())}`);
    check(`book turn ${i + 1} ran on Haiku`, cBook.lastModelTier === "haiku", cBook.lastModelTier);
    if (bookedConfirms.length > 0) booked = true;
  }

  check("slot pre-fetch ran (SlotLock created once address known)", slotLockSeenAfterAddress, { address: cBook.address });
  check("BOOKED handoff reached the existing confirm path", bookedConfirms.length > 0, bookedConfirms);
  if (bookedConfirms.length > 0) {
    const b = bookedConfirms[0];
    check("BOOKED slot is a concrete YYYY-MM-DD HH:MM", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(b.slot), b.slot);
    check("BOOKED carried the collected address", !!b.address, b.address);
    console.log(`  → CONFIRM PATH received: slot=${b.slot} address=${JSON.stringify(b.address)} summary=${JSON.stringify(b.summary)}`);
  }

  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  await cleanup();
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`[alex:live] fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  await cleanup().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
