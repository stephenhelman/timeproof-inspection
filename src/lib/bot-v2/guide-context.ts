// THE single source of truth for the sr_guide_context vocabulary (Sprint 9 Part G).
// sr_guide_context is the guide-side analogue of sr_dispo_context (dispo-context.ts):
// a contact field that rides every webhook, carrying the nuance from the Roof Guide
// pipeline into Inspection/qualify. Where sr_dispo_context says "how a lead left the
// Inspection", sr_guide_context says "how a lead crossed from the Guide".
//
// The ONLY non-empty value today is `zip_cleared`: an expansion-zone lead whose
// inspection interest was committed (NEPQ pullback) but who sat outside the service
// area, was HELD for manual zip review, and was then cleared by a human reviewer. An
// in-area lead (zip auto-approved) crosses immediately and carries NO guide context
// (empty is safe — only the held path reads a value).
//
// Critical ordering the Guide bot enforces (mission-file behavior, not code): the
// NEPQ structured pullback is UNIVERSAL and comes FIRST; the service-area check is a
// POST-commitment gate. Never cool a just-warmed lead with a logistics question.

export const GUIDE_CONTEXT = {
  // Held expansion-zone lead, manually cleared. Qualify opens with the
  // "good news, we service your area" acknowledgment (the re-engagement IS the
  // qualify opener — there is no separate clearance message).
  ZIP_CLEARED: "zip_cleared",
} as const;

export const GUIDE_CONTEXT_VALUES = [GUIDE_CONTEXT.ZIP_CLEARED] as const;
export type GuideContext = (typeof GUIDE_CONTEXT_VALUES)[number];

// Did this lead cross from a held-then-cleared zip review? Drives the qualify opener.
export function isZipCleared(srGuideContext: string | null | undefined): boolean {
  return srGuideContext === GUIDE_CONTEXT.ZIP_CLEARED;
}

// Which qualify opener to use. Two axes decide it: was the lead HELD for a zip
// review then cleared (sr_guide_context = zip_cleared), and did it cross WARMED from
// nurture (sourceType "guide" — a guide lead reaches qualify ONLY by qualifying out
// of nurture, so it arrives with surfaced problem + consequence + commitment;
// ARCHITECTURE §9 routing). A direct inspection requester (sourceType "inspection",
// or facebook/waitlist) has NO prior conversation and still needs full discovery.
//
//   - "zip_cleared"    → warmed guide lead, held then cleared → CONTINUE the nurture
//                        arc + the "good news, we service your area" acknowledgment.
//   - "warmed_handoff" → warmed guide lead, in-area, just crossed from nurture →
//                        CONTINUE (acknowledge surfaced consequence/commitment, same
//                        Alex) and go to the OPEN gate (decision-maker) → booking.
//   - "fresh"          → direct inspection/facebook/waitlist requester, no prior
//                        conversation → the source-aware discovery opener.
//
// "warmed_handoff" closes the nurture→qualify continuity gap (mirrors book's
// qualified_handoff continuation opener): without it a warmed guide lead got the
// "no prior conversation" fresh opener and re-asked the nurture cold-open question.
export type QualifyOpenerKind = "zip_cleared" | "warmed_handoff" | "fresh";

export function qualifyOpenerKind(
  srGuideContext: string | null | undefined,
  sourceType?: string | null,
): QualifyOpenerKind {
  if (isZipCleared(srGuideContext)) return "zip_cleared";
  if (sourceType === "guide") return "warmed_handoff";
  return "fresh";
}

// The system-turn opener instruction injected when qualify activates. A guide lead
// is ALWAYS a warmed nurture hand-off (it reached qualify only by qualifying out of
// nurture), so its opener CONTINUES the conversation — never reintroduces, never
// re-asks what prompted the guide. Only a direct inspection/facebook/waitlist
// requester gets the fresh discovery opener. The warmed context (consequence-
// Surfaced / gateProblem / motivation / summary / funnelConcerns) is already in
// conversation_state — the opener tells the model to use it, not re-collect it.
export function qualifyOpenerInstruction(
  srGuideContext: string | null | undefined,
  sourceType?: string | null,
): string {
  const kind = qualifyOpenerKind(srGuideContext, sourceType);

  if (kind === "zip_cleared") {
    // Warmed guide lead, held for zip then cleared. CONTINUE the nurture arc AND
    // deliver the good news — one continuous Alex, not a new greeting.
    return (
      `[system: returning qualify lead — you are the SAME Alex this homeowner was just talking to, ` +
      `picking the conversation back up, NOT a new greeting. They were warmed in nurture (their ` +
      `problem, the consequence, and their commitment to have someone look are already in ` +
      `conversation_state) and were then HELD for a quick service-area check, which just CLEARED. ` +
      `Open as a CONTINUATION: in one warm beat, acknowledge what they already surfaced and committed ` +
      `to (reference conversation_state consequenceSurfaced / motivation / summary), then deliver the ` +
      `good news that you're good to come take a look. Do NOT reintroduce yourself, do NOT re-ask what ` +
      `prompted the guide, do NOT re-run discovery. Problem + consequence are already met — your open ` +
      `gate is the decision-maker: as a natural next beat ask "is it just you on this, or is there a ` +
      `spouse or partner who'd want to weigh in?" then move toward setting up the visit. Trust the ` +
      `prior gates by DEFAULT, but if they read unconvinced or shaky, it's fine to gently re-engage a ` +
      `gate rather than push past it.]`
    );
  }

  if (kind === "warmed_handoff") {
    // Warmed guide lead, in-area, just crossed from nurture. The continuity fix:
    // acknowledge + continue, never a cold reset. Paced across turns — the OPENER is
    // ONE beat (acknowledge + an inspection-framed open question, then STOP); the
    // decision-maker gate is the NEXT beat, after the lead responds — NOT crammed in.
    return (
      `[system: continuing qualify lead — you are the SAME Alex this homeowner was just talking to in ` +
      `nurture, NOT a new greeting and NOT a fresh start. They are already WARMED: nurture surfaced ` +
      `their problem, the consequence of leaving it, and their commitment to have someone come look — ` +
      `all of it is in conversation_state (consequenceSurfaced / gateProblem / motivation / summary / ` +
      `funnelConcerns). Gates 1 + 2 (problem + consequence) are already MET — do NOT reintroduce ` +
      `yourself, do NOT re-ask what prompted the guide, do NOT re-run or re-litigate the discovery ` +
      `nurture already did.\n` +
      `THIS OPENER IS ONE BEAT, then you STOP: (a) warmly acknowledge what they surfaced and the ` +
      `commitment they made (reference the actual content from conversation_state, in your own words), ` +
      `then (b) ask ONE open, INSPECTION-FRAMED question — framed toward the visit that's already ` +
      `happening, e.g. "anything specific you'd want them to take a look at while they're up there?" ` +
      `This presupposes the inspection (keeps momentum) and leaves room to catch a missed issue — a ` +
      `second area, another concern — to feed to the inspection. It is logistics-flavored (what to ` +
      `look at), NOT an open-ended "anything else we should know?" that could invite doubt in a ` +
      `committed lead. End the message there — do NOT also ask the decision-maker question in this ` +
      `same message.\n` +
      `NEXT BEAT (after they reply, NOT now): if they surface something new, briefly note it for the ` +
      `inspection; either way your remaining OPEN gate is the decision-maker — confirm who's involved ` +
      `as the next beat: "is it just you on this, or is there a spouse or partner who'd want to weigh ` +
      `in?" — then move toward setting up the visit. Work the OPEN gate, not the whole sequence.\n` +
      `The prior gates are a trusted DEFAULT, not a lock: if the lead now reads unconvinced or shaky ` +
      `on the problem or the consequence, you may gently re-engage that gate rather than pushing past ` +
      `it — the flags are a trusted prior, not an override.]`
    );
  }

  // Fresh direct inspection/facebook/waitlist requester — genuinely no prior
  // conversation; run full source-aware discovery.
  return (
    `[system: new qualify lead — send your source-aware opening message. ` +
    `No prior conversation. Read sourceType/funnelConcerns and open accordingly.]`
  );
}
