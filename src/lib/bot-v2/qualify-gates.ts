// THE three-gate guard for QUALIFY (sprint_4 "THREE GATES"; ARCHITECTURE §6
// QUALIFIED + §7 gate fields). Pure + side-effect-free so the structural rule —
// "QUALIFIED is honored ONLY when all three gates are genuinely true" — is directly
// unit-testable, like resolveActivation / planDispo.
//
// The qualify prompt INSTRUCTS the model to emit QUALIFIED only when all three gates
// hold, but a prompt instruction is not enforcement: on the live run the model
// emitted QUALIFIED after surfacing the problem + consequence but WITHOUT ever
// confirming the decision-maker (gate 3). A booked inspection where the decision-
// maker isn't present is a porch waiting to happen — so the gate is enforced in CODE:
// the qualify handler downgrades a premature QUALIFIED to "continue" (null) instead
// of handing off to book.
//
// The gates are read from the ACCUMULATED Conversation state (after this turn's delta
// is applied), so a gate set on an earlier turn still counts — gateProblem and
// consequenceSurfaced are sticky-true, and gateDecisionMaker must finally be true too.

export interface QualifyGateState {
  gateProblem: boolean;
  consequenceSurfaced: boolean; // gate "consequence" IS consequenceSurfaced (no separate field)
  gateDecisionMaker: boolean;
}

// All three gates genuinely true → QUALIFIED may hand off. Any gate false → not yet.
export function qualifiedGatesMet(g: QualifyGateState): boolean {
  return g.gateProblem === true && g.consequenceSurfaced === true && g.gateDecisionMaker === true;
}
