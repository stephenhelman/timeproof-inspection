-- Sprint 2: Add ghlSyncPending flag to Appointment for GHL sync fallback
ALTER TABLE "Appointment" ADD COLUMN "ghlSyncPending" BOOLEAN NOT NULL DEFAULT false;
