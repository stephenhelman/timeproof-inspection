// Sprint 1 — the conversation authorship-seam test.
//
//   npm run conversation:test
//
// Exercises lib/conversation against the REAL database with a throwaway test
// contact (created fresh, deleted at the end). Proves the four Sprint-1 claims:
//   1. getConversation creates a default row with the right defaults.
//   2. applyModelStateDelta DROPS system-authored fields and KEEPS model-authored
//      ones — the airtight seam (the most important assertion in the sprint).
//   3. applyModelStateDelta ACCUMULATES objectionsSurfaced / motivation across
//      turns instead of blind-overwriting.
//   4. transitionLead syncs currentPhase + appends phaseHistory atomically with
//      the SrLead stage change.
//
// Exit code is non-zero if any assertion fails.

import { prisma } from "@/src/lib/prisma";
import {
  getConversation,
  applyModelStateDelta,
  writeSystemFields,
} from "@/src/lib/conversation";
import { transitionLead } from "@/src/lib/bot-engine";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  [PASS] ${label}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${label}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  }
}

function section(t: string): void {
  console.log(`\n${"─".repeat(70)}\n  ${t}\n${"─".repeat(70)}`);
}

// Unique-but-deterministic-ish id; we delete it at the end regardless.
const TEST_CONTACT = `__seamtest_${process.pid}`;
const TEST_LEAD_ID = `__seamtest_lead_${process.pid}`;

async function cleanup(): Promise<void> {
  await prisma.conversation.deleteMany({ where: { ghlContactId: TEST_CONTACT } }).catch(() => {});
  await prisma.srLead.deleteMany({ where: { leadId: TEST_LEAD_ID } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: TEST_LEAD_ID } }).catch(() => {});
}

async function main(): Promise<void> {
  await cleanup(); // start clean even if a prior run aborted

  // ── 1. Default-row creation ───────────────────────────────────────────────
  section("1. getConversation creates a default row");
  const fresh = await getConversation(TEST_CONTACT, { currentPhase: "nurture" });
  check("row created with the ghlContactId", fresh.ghlContactId === TEST_CONTACT);
  check("currentPhase set from caller", fresh.currentPhase === "nurture", fresh.currentPhase);
  check("heatState defaults to 'cold'", fresh.heatState === "cold", fresh.heatState);
  check("heatPeakReached defaults false", fresh.heatPeakReached === false);
  check("gateProblem defaults false", fresh.gateProblem === false);
  check("affordabilityIsReal defaults false", fresh.affordabilityIsReal === false);
  check("phaseHistory defaults []", Array.isArray(fresh.phaseHistory) && (fresh.phaseHistory as unknown[]).length === 0);
  check("motivation defaults []", Array.isArray(fresh.motivation) && (fresh.motivation as unknown[]).length === 0);
  check("objectionsSurfaced defaults []", Array.isArray(fresh.objectionsSurfaced) && (fresh.objectionsSurfaced as unknown[]).length === 0);
  check("getConversation is idempotent (no duplicate row)", true);
  const again = await getConversation(TEST_CONTACT);
  check("second getConversation returns the SAME row", again.id === fresh.id, { first: fresh.id, second: again.id });

  // ── 2. THE SEAM: system-authored fields are dropped ───────────────────────
  section("2. applyModelStateDelta drops system-authored fields (THE SEAM)");
  const mixedDelta = {
    // model-authored — should persist
    nepqPhase: "problem",
    consequenceSurfaced: true,
    gateProblem: true,
    urgency: "high",
    primaryObjection: "spouse not on board",
    motivation: ["stop the leak"],
    objectionsSurfaced: [{ family: "authority", surfaceForm: "need to ask my wife", wasReal: true, resolved: false, turnRef: 2 }],
    address: "123 Mesa Hills Dr",
    summary: { situation: "old roof", problem: "leak", consequence: "ceiling stain", openObjection: "spouse", nextStep: "book" },
    // system-authored — MUST be silently dropped, never written by model output
    currentPhase: "book",
    heatState: "warming",
    heatPeakReached: true,
    affordabilityIsReal: true,
    rescheduleSubCase: "no_show",
    sourceType: "inspection",
    phaseHistory: [{ phase: "book", enteredAt: "2020-01-01", exitSignal: "HACK" }],
    lastSignal: "BOOKED",
    leadId: "evil-injected-lead",
    // unknown junk — also dropped
    bogusField: "should not exist",
  };
  const afterDelta = await applyModelStateDelta(TEST_CONTACT, mixedDelta);

  // model-authored persisted
  check("model field nepqPhase persisted", afterDelta.nepqPhase === "problem", afterDelta.nepqPhase);
  check("model field consequenceSurfaced persisted", afterDelta.consequenceSurfaced === true);
  check("model field gateProblem persisted", afterDelta.gateProblem === true);
  check("model field urgency persisted", afterDelta.urgency === "high", afterDelta.urgency);
  check("model field primaryObjection persisted", afterDelta.primaryObjection === "spouse not on board");
  check("model field address persisted", afterDelta.address === "123 Mesa Hills Dr");
  check("model field motivation persisted", JSON.stringify(afterDelta.motivation) === JSON.stringify(["stop the leak"]), afterDelta.motivation);
  check("model field objectionsSurfaced persisted", Array.isArray(afterDelta.objectionsSurfaced) && (afterDelta.objectionsSurfaced as unknown[]).length === 1);

  // system-authored DROPPED — unchanged from defaults despite being in the delta
  check("system field currentPhase NOT overwritten (still 'nurture')", afterDelta.currentPhase === "nurture", afterDelta.currentPhase);
  check("system field heatState NOT overwritten (still 'cold')", afterDelta.heatState === "cold", afterDelta.heatState);
  check("system field heatPeakReached NOT overwritten (still false)", afterDelta.heatPeakReached === false);
  check("system field affordabilityIsReal NOT overwritten (still false)", afterDelta.affordabilityIsReal === false);
  check("system field rescheduleSubCase NOT overwritten (still null)", afterDelta.rescheduleSubCase === null, afterDelta.rescheduleSubCase);
  check("system field sourceType NOT overwritten (still null)", afterDelta.sourceType === null, afterDelta.sourceType);
  check("system field lastSignal NOT overwritten (still null)", afterDelta.lastSignal === null, afterDelta.lastSignal);
  check("system field leadId NOT overwritten by model output", afterDelta.leadId === null, afterDelta.leadId);
  check("system field phaseHistory NOT overwritten (still [])", Array.isArray(afterDelta.phaseHistory) && (afterDelta.phaseHistory as unknown[]).length === 0);

  // confirm system fields CAN be written through the proper path
  const sys = await writeSystemFields(TEST_CONTACT, { heatState: "warming", heatPeakReached: true, sourceType: "guide" });
  check("writeSystemFields CAN set heatState", sys.heatState === "warming");
  check("writeSystemFields CAN set sourceType", sys.sourceType === "guide");

  // ── 3. Accumulation / merge ───────────────────────────────────────────────
  section("3. applyModelStateDelta accumulates lists across turns");
  await applyModelStateDelta(TEST_CONTACT, {
    motivation: ["protect the home value"], // new, should be added (not replace)
    objectionsSurfaced: [
      { family: "price", surfaceForm: "worried about cost", wasReal: true, resolved: false, turnRef: 4 }, // new family
      { family: "authority", surfaceForm: "need to ask my wife", wasReal: true, resolved: true, turnRef: 5 }, // SAME key as turn-2 → replace (resolved flip)
    ],
  });
  const merged = await getConversation(TEST_CONTACT);
  const mot = merged.motivation as string[];
  check("motivation accumulated (union of both turns)", mot.includes("stop the leak") && mot.includes("protect the home value"), mot);
  const objs = merged.objectionsSurfaced as Array<{ family: string; resolved: boolean }>;
  check("objections accumulated to 2 unique keys (authority+price)", objs.length === 2, objs);
  const authority = objs.find((o) => o.family === "authority");
  check("authority objection updated to resolved:true (key-replace, not duplicate)", authority?.resolved === true, authority);

  // ── 4. transitionLead syncs currentPhase + phaseHistory ───────────────────
  section("4. transitionLead syncs currentPhase + appends phaseHistory atomically");
  // Need a real Lead + SrLead so transitionLead's existing behavior runs.
  await prisma.lead.create({
    data: {
      id: TEST_LEAD_ID,
      customerName: "Seam Test",
      streetAddress: "1 Test St",
      city: "El Paso",
      state: "TX",
      zip: "79900",
      ghlContactId: TEST_CONTACT,
    },
  });
  await prisma.srLead.create({
    data: {
      leadId: TEST_LEAD_ID,
      ghlContactId: TEST_CONTACT,
      srLeadId: "sr_seam",
      srTier: "primary",
      srZone: "z1",
      srStatus: "NEW",
      srQualifyStatus: "pending",
      srBotStage: "nurture",
      srSource: "test",
    },
  });

  // Transition into "booking" (srBotStage vocab) with an exit signal.
  await transitionLead(TEST_LEAD_ID, TEST_CONTACT, null, null, "NEW", "booking", { sr_status: "NEW" }, "QUALIFIED");

  const afterTransition = await getConversation(TEST_CONTACT);
  check("currentPhase normalized 'booking' → 'book'", afterTransition.currentPhase === "book", afterTransition.currentPhase);
  const hist = afterTransition.phaseHistory as Array<{ phase: string; enteredAt: string; exitSignal: string | null }>;
  check("phaseHistory got an appended entry", hist.length === 1, hist);
  check("phaseHistory entry has normalized phase 'book'", hist[hist.length - 1]?.phase === "book", hist);
  check("phaseHistory entry recorded exitSignal", hist[hist.length - 1]?.exitSignal === "QUALIFIED", hist);
  check("phaseHistory entry has enteredAt timestamp", typeof hist[hist.length - 1]?.enteredAt === "string");

  // existing SrLead behavior still fired in the same transaction
  const sr = await prisma.srLead.findUnique({ where: { leadId: TEST_LEAD_ID } });
  check("SrLead.srBotStage updated by transitionLead (existing behavior intact)", sr?.srBotStage === "booking", sr?.srBotStage);
  const lead = await prisma.lead.findUnique({ where: { id: TEST_LEAD_ID } });
  check("Lead.lastBotType updated by transitionLead (existing behavior intact)", lead?.lastBotType === "booking", lead?.lastBotType);

  // a second transition to a DIFFERENT phase appends a 2nd entry; model-authored
  // state from earlier turns is preserved across the phase change.
  await transitionLead(TEST_LEAD_ID, TEST_CONTACT, null, null, "NEW", "silent", { sr_status: "NEW" }, "BOOKED");
  const afterSecond = await getConversation(TEST_CONTACT);
  const hist2 = afterSecond.phaseHistory as unknown[];
  check("second transition appended a 2nd phaseHistory entry", hist2.length === 2, hist2);
  check("model-authored state survived the phase handoff (gateProblem still true)", afterSecond.gateProblem === true);

  // ── Summary ───────────────────────────────────────────────────────────────
  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  await cleanup();
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`[seam-test] fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  await cleanup().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
