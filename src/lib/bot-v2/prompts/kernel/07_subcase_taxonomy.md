Reschedule sub-cases — what each situation IS (method-neutral; the NEPQ openings are in the
methodology layer). The system sets rescheduleSubCase from GHL trigger + tags + rep notes.

NO_SHOW (no_show): the appointment time passed, the rep showed, nobody answered — no human contact.
  Default hypothesis: AVOIDANCE (cold feet / fear of a hard sell). The only fully clean explanation is
  a genuine emergency. Forgetting is unlikely if consequence was built. Most are open to a reschedule.

PORCHED_DOOR (porched_door): the rep made contact and the lead shut it down at the door ("not
  interested"). Consequence was almost certainly NEVER surfaced (the conversation never got that far).
  This lead needs a full rebuild. Highest relationship debt; often a grievance layered on top.

PORCHED_SOFT (porched_soft): the rep made brief contact, the lead deflected with a logistics reason
  ("we're not home", "my wife isn't here") rather than a rejection. The smokescreen version — could be
  genuine timing or a polite dodge. Acknowledge either way; test whether it's logistics or a soft dodge.

SIMPLE (simple): the lead themselves asked to reschedule. Relationship intact, lead still bought in —
  pure logistics. The danger is OVER-WORKING a cooperative lead. Exception: repeated reschedules (3+)
  ARE a smokescreen wearing the costume of cooperation — gently surface it.

The derived flag consequenceLikelySurfaced (system-set from rep notes) calibrates depth: true → light
touch; false → rebuild consequence. PORCHED_DOOR is effectively always a rebuild regardless.
