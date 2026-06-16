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

// Which qualify opener to use, chosen from sr_guide_context. This is the small
// zip-awareness branch the qualify mission gains (Part G step 7) — the rest of
// qualify is identical. "zip_cleared" → the good-news opener; empty → normal.
export type QualifyOpenerKind = "zip_cleared" | "normal";

export function qualifyOpenerKind(srGuideContext: string | null | undefined): QualifyOpenerKind {
  return isZipCleared(srGuideContext) ? "zip_cleared" : "normal";
}

// The system-turn opener instruction injected when qualify activates. The
// zip_cleared variant carries the "good news, we service your area" acknowledgment
// (Part G step 7); the normal variant is the existing source-aware opener.
export function qualifyOpenerInstruction(srGuideContext: string | null | undefined): string {
  if (isZipCleared(srGuideContext)) {
    return (
      `[system: new qualify lead — this homeowner was HELD for a service-area (zip) review and has ` +
      `just been CLEARED. Open with the good news that you service their area, then move into ` +
      `qualifying: "good news, we service your area — before we schedule…". Do NOT re-collect what the ` +
      `guide already captured; this re-engagement IS your opener. Read sourceType/funnelConcerns.]`
    );
  }
  return (
    `[system: new qualify lead — send your source-aware opening message. ` +
    `No prior conversation. Read sourceType/funnelConcerns and open accordingly.]`
  );
}
