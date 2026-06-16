// Sprint 7 — disposition routing table + Jordan derivation test.
//
//   npm run dispo:test
//
// Pure-logic test (no DB, no GHL): proves the §8 routing table (planDispo) maps
// every dispo outcome to the right Inspection resolution, sr_dispo_context value,
// reporting tag, destination Revival stage, and botStage; and that the Jordan
// reschedule handler derives the correct sub-case from sr_dispo_context.
//
// Exit code is non-zero if any assertion fails.

import { planDispo, type DispoPlan } from "@/src/lib/bot-v2/dispo-plan";
import { deriveRescheduleSubCase } from "@/src/lib/bot-handlers/jordan-recovery";
import { rescheduleSubCaseFromDispoContext } from "@/src/lib/bot-v2/dispo-context";
import type { Lead } from "@prisma/client";

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

// Helper: planDispo or throw (the error branch is asserted separately).
function plan(outcome: Parameters<typeof planDispo>[0], fork: Record<string, unknown> = {}): DispoPlan {
  const p = planDispo(outcome, fork);
  if ("error" in p) throw new Error(`unexpected planDispo error: ${p.error}`);
  return p;
}

const E = process.env;

function main(): void {
  // ── SOLD ──────────────────────────────────────────────────────────────────
  section("SOLD → Inspection won (Pending Sold); no Revival opp");
  {
    const p = plan("sold");
    check("leadStatus PENDING_SOLD_CONFIRMATION", p.leadStatus === "PENDING_SOLD_CONFIRMATION", p.leadStatus);
    check("Inspection resolved WON", p.inspectionStatus === "won", p.inspectionStatus);
    check("Inspection stage = INSPECTION_PENDING_SOLD", p.inspectionResolveStage === E.GHL_STAGE_INSPECTION_PENDING_SOLD, p.inspectionResolveStage);
    check("reporting tag sr_pending_sold", p.reportingTag === "sr_pending_sold", p.reportingTag);
    check("NO Revival opp", p.revivalStage === undefined);
    check("no sr_dispo_context", p.srDispoContext === null);
    check("botStage silent", p.botStage === "silent", p.botStage);
    check("manager notified", p.managerNotify === true);
  }

  // ── NO SHOW ─────────────────────────────────────────────────────────────────
  section("NO SHOW → Inspection lost; Revival opp at Reschedule stage");
  {
    const p = plan("no_show");
    check("leadStatus NO_SHOW", p.leadStatus === "NO_SHOW", p.leadStatus);
    check("Inspection resolved LOST", p.inspectionStatus === "lost", p.inspectionStatus);
    check("Inspection stage = NO_SHOW", p.inspectionResolveStage === E.GHL_STAGE_NO_SHOW, p.inspectionResolveStage);
    check("sr_dispo_context = no_show", p.srDispoContext === "no_show", p.srDispoContext);
    check("reporting tag no_show", p.reportingTag === "no_show", p.reportingTag);
    check("Revival opp at RESCHEDULING stage", p.revivalStage === E.GHL_STAGE_RESCHEDULING, p.revivalStage);
    check("botStage reschedule", p.botStage === "reschedule", p.botStage);
  }

  // ── PORCHED (door / soft) ────────────────────────────────────────────────────
  section("PORCHED door/soft → Inspection lost; Revival at Reschedule; door|soft nuance");
  {
    const door = plan("porched", { porchedContext: "door" });
    check("door: sr_dispo_context = door", door.srDispoContext === "door", door.srDispoContext);
    check("door: reporting tag porched", door.reportingTag === "porched", door.reportingTag);
    check("door: Inspection lost @ NO_SHOW", door.inspectionStatus === "lost" && door.inspectionResolveStage === E.GHL_STAGE_NO_SHOW);
    check("door: Revival @ RESCHEDULING", door.revivalStage === E.GHL_STAGE_RESCHEDULING, door.revivalStage);
    check("door: botStage reschedule", door.botStage === "reschedule");

    const soft = plan("porched", { porchedContext: "soft" });
    check("soft: sr_dispo_context = soft", soft.srDispoContext === "soft", soft.srDispoContext);

    const dflt = plan("porched");
    check("default toggle = door", dflt.srDispoContext === "door", dflt.srDispoContext);
  }

  // ── RESCHEDULE → Book Now (manual) ───────────────────────────────────────────
  section("RESCHEDULE Book Now → no opp resolution, no Revival, no phase change");
  {
    const p = plan("reschedule", { reschedulePath: "manual" });
    check("leadStatus unchanged (null)", p.leadStatus === null);
    check("no Inspection resolution", p.inspectionStatus === null && p.inspectionResolveStage === undefined);
    check("no Revival opp", p.revivalStage === undefined);
    check("no reporting tag", p.reportingTag === null);
    check("no phase change (botStage null)", p.botStage === null);
    check("no sr_dispo_context", p.srDispoContext === null);
    check("rescheduleReason recorded = manual", p.leadData.rescheduleReason === "manual");
  }

  // ── RESCHEDULE → Send to Office ──────────────────────────────────────────────
  section("RESCHEDULE Send to Office → Inspection lost; Revival at Reschedule; simple");
  {
    const p = plan("reschedule", { reschedulePath: "office" });
    check("sr_dispo_context = simple", p.srDispoContext === "simple", p.srDispoContext);
    check("reporting tag reschedule_office", p.reportingTag === "reschedule_office", p.reportingTag);
    check("Inspection resolved LOST", p.inspectionStatus === "lost");
    check("Revival opp at RESCHEDULING stage", p.revivalStage === E.GHL_STAGE_RESCHEDULING, p.revivalStage);
    check("botStage reschedule", p.botStage === "reschedule");
    check("default path (no reschedulePath) = office", plan("reschedule").reportingTag === "reschedule_office");
  }

  // ── DEMO NOT SOLD — reasons 1–5 ──────────────────────────────────────────────
  section("DEMO NOT SOLD reasons → Inspection lost; Revival at Revival(FollowUp); objection nuance");
  {
    for (const objection of ["think_about_it", "price", "urgency", "insurance", "other"]) {
      const p = plan("demo_not_sold", { dispoPrimaryObjection: objection });
      check(`${objection}: sr_dispo_context = ${objection}`, p.srDispoContext === objection, p.srDispoContext);
      check(`${objection}: Revival @ FOLLOW_UP_ACTIVE`, p.revivalStage === E.GHL_STAGE_FOLLOW_UP_ACTIVE, p.revivalStage);
      check(`${objection}: botStage revival`, p.botStage === "revival", p.botStage);
    }
    const p = plan("demo_not_sold", { dispoPrimaryObjection: "price" });
    check("reporting tag sr_demo_not_sold", p.reportingTag === "sr_demo_not_sold", p.reportingTag);
    check("Inspection lost @ DEMO_NOT_SOLD", p.inspectionStatus === "lost" && p.inspectionResolveStage === E.GHL_STAGE_DEMO_NOT_SOLD);
    check("leadStatus DEMO_NOT_SOLD", p.leadStatus === "DEMO_NOT_SOLD");
  }

  // ── DEMO NOT SOLD — Finance Decline ──────────────────────────────────────────
  section("DEMO NOT SOLD Finance Decline → Inspection lost; Revival at FINANCE DISCOVERY");
  {
    const p = plan("demo_not_sold", { dispoPrimaryObjection: "finance_decline" });
    check("Revival opp at FINANCE_DISCOVERY stage", p.revivalStage === E.GHL_STAGE_FINANCE_DISCOVERY, p.revivalStage);
    check("botStage finance", p.botStage === "finance", p.botStage);
    check("reporting tag sr_finance_declined", p.reportingTag === "sr_finance_declined", p.reportingTag);
    check("sr_dispo_context empty (stage says finance)", p.srDispoContext === null, p.srDispoContext);
    check("Inspection lost @ DEMO_NOT_SOLD", p.inspectionStatus === "lost" && p.inspectionResolveStage === E.GHL_STAGE_DEMO_NOT_SOLD);
    check("Finance vs reasons DIVERGE on stage", E.GHL_STAGE_FINANCE_DISCOVERY !== E.GHL_STAGE_FOLLOW_UP_ACTIVE);
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  section("Validation — demo_not_sold requires an objection");
  {
    const r = planDispo("demo_not_sold", {});
    check("missing objection → error", "error" in r, r);
  }

  // ── Jordan derivation: sr_dispo_context → rescheduleSubCase ──────────────────
  section("Jordan derivation — reschedule sub-case from sr_dispo_context");
  {
    check("door → porched_door", rescheduleSubCaseFromDispoContext("door") === "porched_door");
    check("soft → porched_soft", rescheduleSubCaseFromDispoContext("soft") === "porched_soft");
    check("no_show → no_show", rescheduleSubCaseFromDispoContext("no_show") === "no_show");
    check("simple → simple", rescheduleSubCaseFromDispoContext("simple") === "simple");
    check("unknown → null (fall back)", rescheduleSubCaseFromDispoContext("price") === null);

    const bareLead = {} as Lead;
    check("handler: ctx 'door' → porched_door", deriveRescheduleSubCase(bareLead, "door") === "porched_door");
    check("handler: ctx 'soft' → porched_soft", deriveRescheduleSubCase(bareLead, "soft") === "porched_soft");
    check("handler: ctx 'no_show' → no_show", deriveRescheduleSubCase(bareLead, "no_show") === "no_show");

    // Durable Lead.srDispoContext mirror is read when webhook ctx is absent.
    const leadWithCtx = { srDispoContext: "soft" } as unknown as Lead;
    check("handler: Lead.srDispoContext 'soft' → porched_soft", deriveRescheduleSubCase(leadWithCtx) === "porched_soft");

    // Legacy fallback when no sr_dispo_context anywhere.
    const legacyPorch = { rescheduleReason: "porched", dispoNotes: "bad time, come back later" } as unknown as Lead;
    check("legacy fallback: porched + soft notes → porched_soft", deriveRescheduleSubCase(legacyPorch) === "porched_soft");
    const legacyNoShow = { rescheduleReason: "no_show" } as unknown as Lead;
    check("legacy fallback: no_show → no_show", deriveRescheduleSubCase(legacyNoShow) === "no_show");
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────
  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
