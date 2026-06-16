// Sprint 8 — central activation routing table test (§8 unified-handoff proof).
//
//   npm run activation:test
//
// Pure-logic test (no DB, no GHL): proves resolveActivation — the single decision
// central uses — dispatches by STAGE for all six missions and EVERY activation
// trigger, and that the trigger NEVER selects the bot. Mirrors dispo-routing-test.
//
// Exit code is non-zero if any assertion fails.

import {
  resolveActivation,
  type ActivationRoute,
  type Mission,
} from "@/src/lib/bot-v2/activation-routing";

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

function expectMission(trigger: string, stage: string, mission: Mission): void {
  const r: ActivationRoute = resolveActivation(trigger, stage);
  check(
    `${trigger.padEnd(22)} @ stage ${stage.padEnd(11)} → mission ${mission}`,
    r.kind === "mission" && r.mission === mission,
    r,
  );
}

function main(): void {
  // ── 1. inbound_sms dispatches by stage for all six missions ──────────────────
  section("1. inbound_sms → mission BY STAGE (all 6)");
  expectMission("inbound_sms", "nurture", "nurture");
  expectMission("inbound_sms", "qualifying", "qualify");
  expectMission("inbound_sms", "booking", "book");
  expectMission("inbound_sms", "revival", "revival");
  expectMission("inbound_sms", "reschedule", "reschedule");
  expectMission("inbound_sms", "finance", "finance");

  // ── 2. Alex stage-entry activations route by stage (not by trigger) ──────────
  section("2. Alex activations → mission BY STAGE");
  expectMission("new_guide_lead", "nurture", "nurture");
  expectMission("new_inspection_lead", "qualifying", "qualify");
  expectMission("scheduling_approved", "qualifying", "qualify");
  expectMission("qualified_handoff", "booking", "book");
  expectMission("stall_followup", "booking", "book");
  expectMission("stall_exhausted", "booking", "book");
  expectMission("appointment_confirmed", "booking", "book");

  // ── 3. Jordan stage-entry activations route by stage (B3 + legacy aliases) ───
  section("3. Jordan *_activate / *_triggered → mission BY STAGE");
  expectMission("revival_activate", "revival", "revival");
  expectMission("follow_up_triggered", "revival", "revival");
  expectMission("reschedule_activate", "reschedule", "reschedule");
  expectMission("reschedule_triggered", "reschedule", "reschedule");
  expectMission("finance_activate", "finance", "finance");
  expectMission("credit_fail_triggered", "finance", "finance");

  // ── 4. THE §8 PROOF: the trigger name does NOT override the stage ────────────
  // If a Jordan activation trigger somehow arrives while the stage says a DIFFERENT
  // mission, the STAGE wins. This is the divergence guarantee §8 demands.
  section("4. Stage WINS over trigger name (§8 divergence proof)");
  expectMission("revival_activate", "finance", "finance"); // not revival!
  expectMission("finance_activate", "revival", "revival"); // not finance!
  expectMission("reschedule_activate", "nurture", "nurture"); // not reschedule!
  expectMission("qualified_handoff", "qualifying", "qualify"); // trigger says book; stage says qualify → qualify
  expectMission("new_inspection_lead", "booking", "book"); // trigger says qualify; stage says book → book

  // ── 5. Parked-lead re-engagement (the ONE pre-stage path; lead in silent) ──
  section("5. reengage → parked-lead path (NOT a trigger shortcut)");
  for (const stage of ["nurture", "revival", "silent", "finance"]) {
    const r = resolveActivation("reengage", stage);
    check(`reengage @ ${stage.padEnd(11)} → reengage path`, r.kind === "reengage", r);
  }

  // SPRINT 9 (Part A): finance_retry is no longer a pre-stage exception. Finance
  // SOFT_CLOSE re-enters the Finance Retry Pending STAGE (srBotStage stays "finance"),
  // so the 7-day finance_retry routes BY STAGE to the finance mission like every
  // other trigger — the documented §8 finance exception is gone.
  section("5b. finance_retry now routes BY STAGE (Sprint 9 Part A)");
  expectMission("finance_retry", "finance", "finance");
  {
    // A finance_retry that arrives while the lead has moved on (e.g. rebooked →
    // re-qualified, stage no longer "finance") does NOT force the finance bot — the
    // stage wins. A non-mission stage falls through to silent/unknown, never finance.
    const moved = resolveActivation("finance_retry", "silent");
    check("finance_retry @ silent → silent (lead moved on; stage wins)", moved.kind === "silent", moved);
  }

  // ── 6. silent + unknown stages are handled, never guessed ────────────────────
  section("6. silent / unknown stages");
  check("silent stage → { kind: silent }", resolveActivation("inbound_sms", "silent").kind === "silent");
  check("null stage → unknown (never guesses a bot)", resolveActivation("inbound_sms", null).kind === "unknown");
  const ur = resolveActivation("inbound_sms", "bogus_stage");
  check(
    "unrecognized stage → { kind: unknown, srBotStage }",
    ur.kind === "unknown" && ur.srBotStage === "bogus_stage",
    ur,
  );

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  RESULT: ${pass} passed, ${fail} failed`);
  console.log("═".repeat(70));
  if (fail > 0) process.exit(1);
}

main();
