// Bug-A / Bug-B regression test — the two live-Jordan failures from the first
// revival test, covered as pure logic (no DB, no GHL):
//
//   npm run slot:test
//
// Bug A — sr_dispo_context must reach Jordan even with funnelConcerns present:
//   - mergeFunnelConcernsSeed merges the dispo objection INTO existing funnelConcerns
//     instead of dropping it (the old `if (!funnelConcerns)` guard).
//
// Bug B — Jordan's rebooking must respect the stated time preference and never
//   re-offer a rejected window or promise a phantom slot:
//   - detectTimePreference is negation-aware ("I can't do mornings" ≠ morning).
//   - fetchOfferableSlots resolves the preference, filters, and falls back HONESTLY
//     (slotPreferenceNote) when nothing matches — the same engine Alex and Jordan use.
//
// Exit code is non-zero if any assertion fails.

import { detectTimePreference, type TimeOfDay } from "@/src/lib/time-utils";
import {
  fetchOfferableSlots,
  timeOfDayFromPrefs,
  type OfferableSlot,
  type SlotFetcher,
} from "@/src/lib/bot-v2/slot-offer";
import { mergeFunnelConcernsSeed } from "@/src/lib/bot-handlers/jordan-recovery";

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

// A stub SlotFetcher that returns the given slots ONLY for the listed windows; any
// other window resolves empty (so the graceful "any" fallback is exercised).
function stubFetcher(byWindow: Partial<Record<TimeOfDay, OfferableSlot[]>>): SlotFetcher {
  return async (_zone, _dist, pref) => byWindow[pref] ?? [];
}

const MORNING: OfferableSlot[] = [{ date: "2026-06-25", time: "09:00", label: "Thu 9am" }];
const EVENING: OfferableSlot[] = [{ date: "2026-06-25", time: "18:00", label: "Thu 6pm" }];
const ANY: OfferableSlot[] = [{ date: "2026-06-26", time: "10:00", label: "Fri 10am" }];

async function main(): Promise<void> {
  // ── Bug B.1 — detectTimePreference negation ────────────────────────────────
  section("Bug B — detectTimePreference respects negation");
  check(
    '"I can\'t do mornings, you came out in the evening before" → evening (NOT morning)',
    detectTimePreference("I can't do mornings, you came out in the evening before")?.preference === "evening",
    detectTimePreference("I can't do mornings, you came out in the evening before"),
  );
  check(
    '"can\'t do mornings" alone → NOT morning (afternoon|evening survive → no false morning)',
    detectTimePreference("can't do mornings")?.preference !== "morning",
    detectTimePreference("can't do mornings"),
  );
  check(
    '"no afternoons or evenings" → morning (only survivor)',
    detectTimePreference("no afternoons or evenings please")?.preference === "morning",
    detectTimePreference("no afternoons or evenings please"),
  );
  check(
    '"mornings work great" → morning (positive, un-negated)',
    detectTimePreference("mornings work great")?.preference === "morning",
  );
  check(
    '"6pm works" → evening with startHour 18',
    detectTimePreference("6pm works")?.preference === "evening" &&
      detectTimePreference("6pm works")?.startHour === 18,
    detectTimePreference("6pm works"),
  );
  check(
    '"like 5 or 6pm?" → evening (last clock mention, 6pm)',
    detectTimePreference("what's a good time, like 5 or 6pm?")?.preference === "evening",
    detectTimePreference("what's a good time, like 5 or 6pm?"),
  );
  check(
    '"after 2" → afternoon startHour 14',
    detectTimePreference("after 2")?.preference === "afternoon" &&
      detectTimePreference("after 2")?.startHour === 14,
    detectTimePreference("after 2"),
  );
  check('"whenever works" → any', detectTimePreference("whenever works")?.preference === "any");
  check('no signal → null', detectTimePreference("sounds good thanks") === null);

  // ── Bug B.2 — timeOfDayFromPrefs (captured cross-phase preference) ──────────
  section("Bug B — timeOfDayFromPrefs maps captured windows");
  check('windows ["evening"] → evening', timeOfDayFromPrefs({ days: [], windows: ["evening"] }) === "evening");
  check('windows ["after work"] → evening', timeOfDayFromPrefs({ days: [], windows: ["after work"] }) === "evening");
  check("null → null", timeOfDayFromPrefs(null) === null);

  // ── Bug B.3 — fetchOfferableSlots: respect preference, never re-offer rejected ─
  section("Bug B — fetchOfferableSlots respects the stated preference");
  {
    // Lead states evenings on THIS turn; evening slots exist → offer evenings, no note.
    const r = await fetchOfferableSlots(
      { zone: "el_paso_central", isDistanceZone: false, inboundMessage: "evenings only please", storedTimePrefs: null },
      { getSlots: stubFetcher({ evening: EVENING, morning: MORNING }) },
    );
    check("stated evening → evening slots offered", r.slots === EVENING, r.timePreference);
    check("stated evening → no fallback note (real match)", r.slotPreferenceNote === undefined);
  }
  {
    // The live symptom: lead rejected mornings, wants evenings. Morning slots must
    // NOT be what we offer just because they're the soonest.
    const r = await fetchOfferableSlots(
      {
        zone: "el_paso_central",
        isDistanceZone: false,
        inboundMessage: "I can't do mornings, you came out in the evening before",
        storedTimePrefs: null,
      },
      { getSlots: stubFetcher({ evening: EVENING, morning: MORNING }) },
    );
    check("rejected-mornings lead → evening offered, mornings NOT re-offered", r.slots === EVENING, r.slots);
  }
  {
    // Captured preference (no fresh statement this turn) still steers the fetch.
    const r = await fetchOfferableSlots(
      { zone: "el_paso_central", isDistanceZone: false, inboundMessage: null, storedTimePrefs: { days: [], windows: ["evening"] } },
      { getSlots: stubFetcher({ evening: EVENING, morning: MORNING }) },
    );
    check("captured evening pref → evening offered on a system turn", r.slots === EVENING, r.timePreference);
  }

  // ── Bug B.4 — graceful no-availability fallback (no phantom slot) ───────────
  section("Bug B — graceful fallback when the preferred window is empty");
  {
    // Lead wants evenings; NO evening slots exist anywhere → fall back to "any"
    // AND set the note instructing the model to own the miss (never invent 6pm).
    const r = await fetchOfferableSlots(
      { zone: "el_paso_central", isDistanceZone: false, inboundMessage: "evenings only", storedTimePrefs: null },
      { getSlots: stubFetcher({ evening: [], any: ANY }) },
    );
    check("no evening availability → falls back to 'any' slots", r.slots === ANY, r.slots);
    check("no evening availability → slotPreferenceNote set (honest miss)", typeof r.slotPreferenceNote === "string");
    check(
      "fallback note names the missed window",
      !!r.slotPreferenceNote && /evening/i.test(r.slotPreferenceNote),
      r.slotPreferenceNote,
    );
  }
  {
    // Genuinely nothing open at all → empty slots, no note (caller handles no-avail).
    const r = await fetchOfferableSlots(
      { zone: "el_paso_central", isDistanceZone: false, inboundMessage: "evenings only", storedTimePrefs: null },
      { getSlots: stubFetcher({}) },
    );
    check("nothing anywhere → empty slots", r.slots.length === 0);
    check("nothing anywhere → no phantom note", r.slotPreferenceNote === undefined);
  }

  // ── Bug A — merge the dispo objection into existing funnelConcerns ──────────
  section("Bug A — mergeFunnelConcernsSeed surfaces the dispo objection");
  {
    // No existing funnelConcerns → seed object created.
    const m = mergeFunnelConcernsSeed(null, { inspectionFindings: "cracked flashing", priorObjection: "price" }) as Record<string, unknown>;
    check("null funnelConcerns → seed object", m.priorObjection === "price" && m.inspectionFindings === "cracked flashing", m);
  }
  {
    // Existing guide concerns (object) WITHOUT a priorObjection → objection merged in
    // (the live Bug-A case: guide-origin lead had funnelConcerns, objection was dropped).
    const existing = { guideConcern: "missing shingles", roofAge: "18" };
    const m = mergeFunnelConcernsSeed(existing, { inspectionFindings: null, priorObjection: "think_about_it" }) as Record<string, unknown>;
    check("existing object → objection merged in", m.priorObjection === "think_about_it", m);
    check("existing object → guide concerns preserved", m.guideConcern === "missing shingles" && m.roofAge === "18", m);
  }
  {
    // Existing object already HAS a priorObjection → do not clobber it.
    const existing = { priorObjection: "competitor" };
    const m = mergeFunnelConcernsSeed(existing, { inspectionFindings: null, priorObjection: "price" }) as Record<string, unknown>;
    check("existing priorObjection not clobbered", m.priorObjection === "competitor", m);
  }
  {
    // Array form (guide concern list) → preserved under `concerns`, objection attached.
    const existing = ["damage signs", "roof age"];
    const m = mergeFunnelConcernsSeed(existing, { inspectionFindings: null, priorObjection: "urgency" }) as Record<string, unknown>;
    check("array form → concerns preserved + objection attached", Array.isArray(m.concerns) && m.priorObjection === "urgency", m);
  }
  {
    // Nothing to seed → existing returned unchanged.
    const existing = { guideConcern: "x" };
    const m = mergeFunnelConcernsSeed(existing, { inspectionFindings: null, priorObjection: null });
    check("nothing to seed → existing unchanged", m === existing);
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  section("RESULT");
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
