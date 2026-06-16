-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "ghlContactId" TEXT NOT NULL,
    "leadId" TEXT,
    "currentPhase" TEXT NOT NULL,
    "phaseHistory" JSONB NOT NULL DEFAULT '[]',
    "nepqPhase" TEXT,
    "motivation" JSONB NOT NULL DEFAULT '[]',
    "urgency" TEXT,
    "consequenceSurfaced" BOOLEAN NOT NULL DEFAULT false,
    "gateProblem" BOOLEAN NOT NULL DEFAULT false,
    "gateDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "objectionsSurfaced" JSONB NOT NULL DEFAULT '[]',
    "primaryObjection" TEXT,
    "decisionMakers" JSONB NOT NULL DEFAULT '[]',
    "timePrefs" JSONB,
    "address" TEXT,
    "sourceType" TEXT,
    "sourceChannel" TEXT,
    "funnelConcerns" JSONB,
    "repName" TEXT,
    "consequenceLikelySurfaced" BOOLEAN,
    "affordabilityIsReal" BOOLEAN NOT NULL DEFAULT false,
    "rescheduleSubCase" TEXT,
    "daysSinceAppointment" INTEGER,
    "heatState" TEXT NOT NULL DEFAULT 'cold',
    "heatLastInbound" TIMESTAMP(3),
    "heatPeakReached" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,
    "lastSignal" TEXT,
    "lastModelTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_ghlContactId_key" ON "Conversation"("ghlContactId");

-- CreateIndex
CREATE INDEX "Conversation_ghlContactId_idx" ON "Conversation"("ghlContactId");
