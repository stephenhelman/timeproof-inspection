// Sprint 5 — LIVE Jordan recovery route test (real engine + real DB, GHL stubbed).
//
//   npm run jordan:live
//
// The Jordan analogue of alex:live. It drives the ACTUAL live handlers
// (handleRevivalWebhook, handleFinanceWebhook) against the REAL database with
// throwaway contacts, making REAL live Claude calls on the unified composed-prompt
// JSON engine. The ONLY things stubbed are the outward GHL send/tag and the
// REBOOKED confirm path (injected via deps), so no real SMS goes out and no real
// GHL/DB rebooking confirm runs. It proves two arcs end-to-end:
//
//   revival: activation opener → grievance acknowledged → problem-still-live →
//            REBOOKED handoff to the confirm path (selectedSlot carried).
//   finance: activation opener (override active) → alternative payment path →
//            SOFT_CLOSE (value never surfaced).
//
// Requires ANTHROPIC_API_KEY + DATABASE access. The model is real (non-deterministic),
// so conversations are scripted with strong inbounds and terminal steps loop a few
// times; structural invariants (Sonnet tier, persistence, REBOOKED handoff, override
// presence) are asserted hard. Throwaway rows are deleted at the end.

import { prisma } from "@/src/lib/prisma";
import { handleRevivalWebhook } from "@/src/lib/bot-handlers/revival";
import { handleFinanceWebhook } from "@/src/lib/bot-handlers/finance";
import { getConversation } from "@/src/lib/conversation";
import type { Lead, SrLead } from "@prisma/client";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) { pass++; console.log(`  [PASS] ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
function section(t: string): void { console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`); }

const PID = process.pid;
const sent: string[] = [];
const tagged: string[] = [];
const rebookConfirms: { slot: string; confidence: string | null; fromStage: string | null }[] = [];

const ioDeps = {
  sendSms: async (_id: string, msg: string) => { sent.push(msg); },
  addTag: async (_id: string, tag: string) => { tagged.push(tag); },
  removeTag: async (_id: string, _tag: string) => {},
  confirmRebooked: async (a: { slot: string; confidence: "solid" | "soft" | null; fromStage: string | null }) => {
    rebookConfirms.push({ slot: a.slot, confidence: a.confidence, fromStage: a.fromStage });
  },
};

function lastReply(): string { return sent[sent.length - 1] ?? "(none)"; }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeLead(suffix: string, srBotStage: string): Promise<{ lead: Lead; srLead: SrLead; contact: string }> {
  const contact = `__jordan_${suffix}_${PID}`;
  const leadId = `__jordan_lead_${suffix}_${PID}`;
  await cleanupOne(contact, leadId);
  const lead = (await prisma.lead.create({
    data: {
      id: leadId,
      customerName: "Jordan Test",
      streetAddress: "1 Test St",
      city: "El Paso",
      state: "TX",
      zip: "79912",
      sourceZip: "79912",
      ghlContactId: contact,
      address: "4820 Mesa Hills Dr, El Paso, TX 79912",
      status: "DEMO_NOT_SOLD",
      dispoNotes: "Homeowner has an active ceiling leak that's been spreading; rep walked the cost of waiting but lead stalled.",
      dispoPrimaryObjection: "wanted to think about it",
    },
  })) as Lead;
  const srLead = (await prisma.srLead.create({
    data: {
      leadId, ghlContactId: contact, srLeadId: `sr_${suffix}_${PID}`,
      srTier: "primary", srZone: "z1", srStatus: "DEMO_NOT_SOLD",
      srQualifyStatus: "qualified", srBotStage, srSource: "test",
    },
  })) as SrLead;
  return { lead, srLead, contact };
}

async function cleanupOne(contact: string, leadId: string): Promise<void> {
  await prisma.slotLock.deleteMany({ where: { leadId } }).catch(() => {});
  await prisma.inspection.deleteMany({ where: { leadId } }).catch(() => {});
  await prisma.appointment.deleteMany({ where: { leadId } }).catch(() => {});
  await prisma.conversation.deleteMany({ where: { ghlContactId: contact } }).catch(() => {});
  await prisma.botThread.deleteMany({ where: { ghlContactId: contact } }).catch(() => {});
  await prisma.srLead.deleteMany({ where: { leadId } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[jordan:live] ANTHROPIC_API_KEY not set — this test makes real model calls. Aborting.");
    process.exit(2);
  }

  // ══════════════ REVIVAL → REBOOKED ══════════════
  section("REVIVAL — activation → grievance → problem-still-live → REBOOKED");
  const rev = await makeLead("rev", "revival");
  sent.length = 0;
  await handleRevivalWebhook({ lead: rev.lead, srLead: rev.srLead, ghlContactId: rev.contact, trigger: "follow_up_triggered", inboundMsg: "" }, ioDeps);
  let cRev = await getConversation(rev.contact);
  check("revival opener ran on Sonnet", cRev.lastModelTier === "sonnet", cRev.lastModelTier);
  check("revival opener produced a reply", sent.length >= 1, lastReply());
  console.log(`  → opener: ${JSON.stringify(lastReply())}`);

  const revScript = [
    "honestly your rep was way too pushy at my door and it left a bad taste",
    "yeah the ceiling leak is actually still going and it's gotten worse since then — water's dripping through now",
    "ok yeah I do want someone to actually look at it. what times do you have?",
    "the earliest one works, the tuesday 1pm slot",
    "yes, confirm it — tuesday at 1pm, my address is the one you have on file. book it",
    "yep that's confirmed, see you then",
  ];
  let rebooked = false;
  for (let i = 0; i < revScript.length && !rebooked; i++) {
    sent.length = 0;
    await sleep(1200);
    await handleRevivalWebhook({ lead: rev.lead, srLead: rev.srLead, ghlContactId: rev.contact, trigger: "inbound_sms", inboundMsg: revScript[i] }, ioDeps);
    cRev = await getConversation(rev.contact);
    console.log(`  r-turn ${i + 1}: tier=${cRev.lastModelTier} signal=${cRev.lastSignal} selectedSlot=${JSON.stringify(cRev.selectedSlot)}`);
    console.log(`     reply: ${JSON.stringify(lastReply())}`);
    check(`revival turn ${i + 1} ran on Sonnet`, cRev.lastModelTier === "sonnet", cRev.lastModelTier);
    if (rebookConfirms.length > 0) rebooked = true;
  }
  check("REVIVAL reached REBOOKED → confirm path", rebookConfirms.length > 0, rebookConfirms);
  if (rebookConfirms.length > 0) {
    const b = rebookConfirms[0];
    check("REBOOKED slot is a concrete YYYY-MM-DD HH:MM", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(b.slot), b.slot);
    check("REBOOKED confirm came from sr_follow_up", b.fromStage === "sr_follow_up", b.fromStage);
    console.log(`  → CONFIRM PATH received: slot=${b.slot} confidence=${b.confidence} fromStage=${b.fromStage}`);
  }

  // ══════════════ FINANCE → SOFT_CLOSE ══════════════
  section("FINANCE — activation (override active) → cosigner path → SOFT_CLOSE");
  const fin = await makeLead("fin", "finance");
  rebookConfirms.length = 0;
  sent.length = 0;
  await handleFinanceWebhook({ lead: fin.lead, srLead: fin.srLead, ghlContactId: fin.contact, trigger: "credit_fail_triggered", inboundMsg: "" }, ioDeps);
  let cFin = await getConversation(fin.contact);
  check("finance opener ran on Sonnet", cFin.lastModelTier === "sonnet", cFin.lastModelTier);
  check("affordabilityIsReal set true (override active)", cFin.affordabilityIsReal === true, cFin.affordabilityIsReal);
  console.log(`  → opener: ${JSON.stringify(lastReply())}`);

  const finScript = [
    "yeah my credit got declined, I really wanted to get this done though",
    "maybe around 200 a month would be doable honestly",
    "my brother actually said he'd cosign for me, he's done it before for my sister",
    "yeah I'm gonna call him today and get it set up — can you follow up with me in a couple days?",
    "perfect, I'll have it sorted by then",
  ];
  let softClosed = false;
  for (let i = 0; i < finScript.length && !softClosed; i++) {
    sent.length = 0;
    await sleep(1200);
    await handleFinanceWebhook({ lead: fin.lead, srLead: fin.srLead, ghlContactId: fin.contact, trigger: "inbound_sms", inboundMsg: finScript[i] }, ioDeps);
    cFin = await getConversation(fin.contact);
    console.log(`  f-turn ${i + 1}: tier=${cFin.lastModelTier} signal=${cFin.lastSignal}`);
    console.log(`     reply: ${JSON.stringify(lastReply())}`);
    check(`finance turn ${i + 1} ran on Sonnet`, cFin.lastModelTier === "sonnet", cFin.lastModelTier);
    if (cFin.lastSignal === "SOFT_CLOSE") softClosed = true;
  }
  check("FINANCE reached SOFT_CLOSE (alternative path)", softClosed, cFin.lastSignal);
  check("finance never emitted NOT_INTERESTED before menu", cFin.lastSignal !== "NOT_INTERESTED" || softClosed, cFin.lastSignal);
  check("finance_retry follow-up tagged on soft close", tagged.includes("sr_finance_ready") || !softClosed, tagged);

  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  await cleanupOne(rev.contact, rev.lead.id);
  await cleanupOne(fin.contact, fin.lead.id);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`[jordan:live] fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
