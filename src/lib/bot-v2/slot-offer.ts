// ── SHARED SLOT-OFFER ENGINE — one path for every booking caller ─────────────
//
// THE single place time-of-day preference resolution + the graceful no-availability
// fallback live. Both Alex's book flow (book.ts) AND Jordan's rebooking
// (jordan-core.ts) call fetchOfferableSlots — "one scheduling engine, all callers".
//
// Before this module the preference + fallback logic lived inline in book.ts and
// Jordan's rebooking never had it: Jordan called getAvailableSlots(zone, distance)
// with NO preference and NO fallback, so it re-offered slots the homeowner had just
// rejected ("I can't do mornings") and, finding nothing in the wanted window,
// invented a phantom slot it could never confirm. Routing both callers here closes
// that gap for good — fix it once, every caller benefits.
//
// Preference precedence (matches the original book.ts BUG-1 fix):
//   1. a preference stated in THIS inbound message (the freshest signal), then
//   2. the preference CAPTURED earlier (Conversation.timePrefs the qualify/book
//      model authored), then
//   3. "any".
// detectTimePreference is now negation-aware ("can't do mornings" never resolves to
// morning), so a rejected window can no longer be re-offered.

import { getAvailableSlots } from "@/src/lib/bot-engine";
import { detectTimePreference, TIME_WINDOWS, type TimeOfDay } from "@/src/lib/time-utils";

export type OfferableSlot = { date: string; time: string; label: string };

export interface FetchOfferableSlotsArgs {
  zone: string;
  isDistanceZone: boolean;
  // The genuine homeowner inbound for this turn, or null on a system/activation turn
  // (openers, nudges) where there is no fresh message to read a preference from.
  inboundMessage: string | null;
  // The cross-phase captured preference (Conversation.timePrefs). Read as the
  // fallback when the inbound states none.
  storedTimePrefs: { days: string[]; windows: string[] } | null | undefined;
}

export interface FetchOfferableSlotsResult {
  slots: OfferableSlot[];
  // The window we actually filtered on (after precedence resolution).
  timePreference: TimeOfDay;
  // Set ONLY when we wanted a specific window, found nothing in it, and fell back to
  // "any" — instructs the model to acknowledge the miss before offering alternates.
  // Honest-fallback, never a phantom promise.
  slotPreferenceNote?: string;
}

// Map the captured cross-phase time preference (Conversation.timePrefs.windows —
// free-form strings the qualify/book model authored, e.g. "evening", "after work",
// "mornings") to the TimeOfDay window getAvailableSlots filters on. Returns null when
// nothing recognizable is present so the caller falls back to "any". Days are not
// used here — getAvailableSlots filters by time-of-day window only.
export function timeOfDayFromPrefs(
  timePrefs: { days: string[]; windows: string[] } | null | undefined,
): TimeOfDay | null {
  const windows = timePrefs?.windows;
  if (!windows || windows.length === 0) return null;
  for (const w of windows) {
    const s = w.toLowerCase();
    if (/even|night|after\s*work|\b[5-8]\s*pm/.test(s)) return "evening";
    if (/morning|early|before\s*noon|\bam\b/.test(s)) return "morning";
    if (/afternoon|midday|noon|lunch|\bpm\b/.test(s)) return "afternoon";
  }
  return null;
}

// Slot-fetch seam — defaults to the real getAvailableSlots; tests inject a stub so
// the preference-resolution + graceful-fallback logic is deterministic without GHL.
export type SlotFetcher = (
  zone: string,
  isDistance: boolean,
  timePreference: TimeOfDay,
  specificStartHour?: number,
) => Promise<OfferableSlot[]>;

// Resolve the offerable slots for a booking turn, honoring the homeowner's stated/
// captured time-of-day preference and falling back HONESTLY when nothing matches.
// Used by both Alex (book) and Jordan (rebooking) so they cannot diverge.
export async function fetchOfferableSlots(
  args: FetchOfferableSlotsArgs,
  deps: { getSlots?: SlotFetcher } = {},
): Promise<FetchOfferableSlotsResult> {
  const getSlots = deps.getSlots ?? getAvailableSlots;
  const detected = args.inboundMessage ? detectTimePreference(args.inboundMessage) : null;
  const storedPreference = timeOfDayFromPrefs(args.storedTimePrefs);
  const timePreference: TimeOfDay = detected?.preference ?? storedPreference ?? "any";

  let slots = await getSlots(
    args.zone,
    args.isDistanceZone,
    timePreference,
    detected?.startHour,
  );

  // Graceful fallback: a real window preference with nothing open in it across the
  // booking window → offer what IS available rather than silently ignoring the
  // preference (or promising a slot that doesn't exist). Tell the model to own the
  // miss before offering the alternates.
  let slotPreferenceNote: string | undefined;
  if (slots.length === 0 && timePreference !== "any") {
    slots = await getSlots(args.zone, args.isDistanceZone, "any");
    if (slots.length > 0) {
      slotPreferenceNote =
        `No ${TIME_WINDOWS[timePreference].label} slots are open in the booking window. The times ` +
        `below are the closest available — acknowledge you couldn't match their ${timePreference} ` +
        `preference exactly before offering them.`;
    }
  }

  return { slots, timePreference, slotPreferenceNote };
}

// Current wall-clock in the booking timezone, formatted for the model's
// `current_datetime` anchor (BUG-2). Derived from the SAME timezone the slot labels
// and the booking math use, so "today/tomorrow" / day-of-week the bot speaks stays
// consistent with the slot it books. Shared so Jordan's rebooking gets the same
// anchor Alex's booking has (previously Jordan passed none).
export function currentMtDatetimeLabel(): string {
  const tz = process.env.BOT_TIMEZONE ?? "America/Denver";
  return (
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    }).format(new Date()) + " (Mountain Time)"
  );
}
