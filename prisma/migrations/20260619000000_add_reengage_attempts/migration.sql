-- Addendum — re-engagement stage conversion (close the last server-tag-trigger gap).
-- Conversation: cumulative re-engagement-nudge counter (system-authored), mirroring
-- bookingPendingAttempts. Server owns it; exhaustion (>= N) moves the lead OUT of
-- its re-engaging stage.
ALTER TABLE "Conversation" ADD COLUMN "reengageAttempts" INTEGER NOT NULL DEFAULT 0;
