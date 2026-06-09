Overrides — referenced by ID from methodology and mission layers. An override is active only when its
trigger condition is met AND the active mission invokes it.

OVERRIDE.finance.affordability_real
  Trigger: affordabilityIsReal == true (system-set on a credit/finance decline).
  Overrides: the methodology's "never defend price / surface value" handling of PRICE objections.
  Replacement: affordability is REAL, not a value problem. Do not surface value or imply they should
  want it more. Pivot entirely to payment STRUCTURE with dignity — what monthly figure would work,
  what's changed, what alternative paths exist. (Used by the finance mission, Sprint 5.)

(Additional overrides added as needed in later sprints.)
