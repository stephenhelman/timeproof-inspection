-- Sprint 9 — timed-event stages, universal booking, tag hygiene.
-- Conversation: cumulative booking-nudge counter + zip-held flag (system-authored).
ALTER TABLE "Conversation" ADD COLUMN "bookingPendingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "zipWasHeld" BOOLEAN NOT NULL DEFAULT false;

-- Lead: durable local mirror of the GHL sr_guide_context contact field (Part G).
ALTER TABLE "Lead" ADD COLUMN "srGuideContext" TEXT;
