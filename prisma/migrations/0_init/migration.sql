-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'INSPECTION_SCHEDULED', 'EN_ROUTE', 'INSPECTION_IN_PROGRESS', 'INSPECTION_COMPLETE', 'QUOTED', 'PENDING_SOLD_CONFIRMATION', 'SOLD', 'DENIED', 'NO_SHOW', 'DEMO_NOT_SOLD', 'REVIVAL_PENDING', 'REVIVAL_RECOVERED', 'DEAD', 'OUT_OF_AREA', 'WAITLIST');

-- CreateEnum
CREATE TYPE "RevivalStatus" AS ENUM ('PENDING', 'ATTEMPTED', 'CONNECTED', 'NOT_INTERESTED', 'NO_ANSWER');

-- CreateEnum
CREATE TYPE "RevivalOutcome" AS ENUM ('RECOVERED', 'REVIEW_REQUESTED', 'REFERRAL_GIVEN', 'DEAD');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REGIONAL', 'SALES_MANAGER', 'SETTER_MANAGER', 'SETTER', 'REP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" TEXT,
    "area" TEXT,
    "profileImageUrl" TEXT,
    "cardShowPhone" BOOLEAN NOT NULL DEFAULT true,
    "cardShowEmail" BOOLEAN NOT NULL DEFAULT true,
    "cardShowArea" BOOLEAN NOT NULL DEFAULT true,
    "cardShowReportLink" BOOLEAN NOT NULL DEFAULT true,
    "cardShowQr" BOOLEAN NOT NULL DEFAULT true,
    "cardShowProfileImage" BOOLEAN NOT NULL DEFAULT true,
    "ghlContactId" TEXT,
    "repSlug" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'REP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "assignedTech" TEXT,
    "createdBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "highestEstimateValue" DOUBLE PRECISION,
    "priorQuoteUrl" TEXT,
    "eagleViewUrl" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "revivalStatus" "RevivalStatus",
    "revivalOutcome" "RevivalOutcome",
    "revivalNotes" TEXT,
    "revivalCalledAt" TIMESTAMP(3),
    "revivalCalledBy" TEXT,
    "appointmentDate" TIMESTAMP(3),
    "jobCompletionDate" TIMESTAMP(3),
    "assignedUserId" TEXT,
    "setterUserId" TEXT,
    "ghlContactId" TEXT,
    "facebookLeadId" TEXT,
    "qualifyToken" TEXT,
    "qualifyTokenExp" TIMESTAMP(3),
    "roofAge" TEXT,
    "knownIssues" JSONB,
    "lastInspected" TEXT,
    "bestTime" TEXT,
    "decisionMakerHome" TEXT,
    "qualifyCompletedAt" TIMESTAMP(3),
    "sourceZip" TEXT,
    "sourceTier" TEXT,
    "smsConsentAt" TIMESTAMP(3),
    "smsConsentIp" TEXT,
    "smsConsentText" TEXT,
    "lastBotMessage" TIMESTAMP(3),
    "lastBotType" TEXT,
    "botOptedOut" BOOLEAN NOT NULL DEFAULT false,
    "calendarConflict" BOOLEAN NOT NULL DEFAULT false,
    "dispoDecisionMakerPresent" BOOLEAN,
    "dispoPrimaryObjection" TEXT,
    "dispoNotes" TEXT,
    "rescheduleReason" TEXT,
    "lenderAttempted" BOOLEAN,
    "pendingSoldAt" TIMESTAMP(3),
    "pendingSoldConfirmedBy" TEXT,
    "roofType" TEXT,
    "issuesNoticed" TEXT,
    "rep" TEXT,
    "guideToken" TEXT,
    "guideUnlockedAt" TIMESTAMP(3),
    "guideSource" TEXT,
    "guideSlug" TEXT,
    "contactFormMessage" TEXT,
    "ghlRecordId" TEXT,
    "ghlOpportunityId" TEXT,
    "address" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrLead" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ghlContactId" TEXT NOT NULL,
    "ghlRecordId" TEXT,
    "srLeadId" TEXT NOT NULL,
    "srTier" TEXT NOT NULL,
    "srZone" TEXT NOT NULL,
    "srStatus" TEXT NOT NULL,
    "srQualifyStatus" TEXT NOT NULL,
    "srBotStage" TEXT NOT NULL,
    "srAppointmentAt" TIMESTAMP(3),
    "srSource" TEXT NOT NULL,
    "srOptedOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SrLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "phase" TEXT,
    "authorName" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "reportUuid" TEXT NOT NULL,
    "userId" TEXT,
    "customerName" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "leadId" TEXT,
    "repName" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownershipLength" TEXT,
    "previousRoofWork" BOOLEAN,
    "previousRoofWhen" TEXT,
    "previousRoofWhy" TEXT,
    "previousRoofNotes" TEXT,
    "previousWork" JSONB,
    "activeLeaks" BOOLEAN,
    "leakLocation" TEXT,
    "issues" JSONB,
    "thingsToKnow" TEXT,
    "allDecisionMakers" BOOLEAN,
    "priorities" TEXT[],
    "findings" JSONB,
    "findingsNotes" TEXT,
    "productionNotes" TEXT,
    "gateCode" TEXT,
    "hasPets" BOOLEAN,
    "accessIssues" TEXT,
    "hoaRestrictions" BOOLEAN,
    "hoaDetails" TEXT,
    "colorSelected" TEXT,
    "specialRequests" TEXT,
    "followUpNotes" TEXT,
    "northStar" TEXT,
    "focusDrivers" TEXT,
    "timeInHome" TEXT,
    "yearBuilt" TEXT,
    "ageOfRoof" TEXT,
    "lastReplacedBy" TEXT,
    "pastRepairs" TEXT,
    "otherProjects" TEXT,
    "hoaPresent" BOOLEAN,
    "hoaName" TEXT,
    "issuesConcerns" TEXT,
    "issueDuration" TEXT,
    "issueImpact" TEXT,
    "rootCauseBeliefBefore" TEXT,
    "triggerMoment" TEXT,
    "priorMeetingHad" BOOLEAN,
    "priorMeetingWho" TEXT,
    "priorMeetingRecommended" TEXT,
    "priorMeetingWhyNotFixed" TEXT,
    "noPriorMeetingReason" TEXT,
    "winDefinition" TEXT,
    "personalFamily" TEXT,
    "personalOccupation" TEXT,
    "personalRecreation" TEXT,
    "personalIdentity" TEXT,
    "decisionMakers" BOOLEAN,
    "decisionMakersWho" TEXT,
    "ghlEventId" TEXT,
    "appointmentAt" TIMESTAMP(3),
    "setterName" TEXT,
    "problemAwarenessBefore" TEXT,
    "problemAwarenessAfter" TEXT,
    "intakePass1Complete" BOOLEAN NOT NULL DEFAULT false,
    "intakePass2Complete" BOOLEAN NOT NULL DEFAULT false,
    "repNotes" TEXT,
    "diagnosis" JSONB,
    "warningSignsCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dispatchedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "qntumExportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inScope" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pipeBoots" INTEGER,
    "skylights" INTEGER,
    "chimneys" INTEGER,
    "boxVents" INTEGER,
    "turbines" INTEGER,
    "atticFans" INTEGER,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facet" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL DEFAULT 'Facet',

    CONSTRAINT "Facet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "photoNumber" INTEGER NOT NULL,
    "r2Key" TEXT NOT NULL,
    "r2Url" TEXT NOT NULL,
    "damageTags" TEXT[],
    "description" TEXT,
    "photoSection" TEXT NOT NULL DEFAULT 'roof',
    "galleryEligible" BOOLEAN NOT NULL DEFAULT false,
    "cityArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nationalPromo" BOOLEAN NOT NULL DEFAULT false,
    "localPromo" BOOLEAN NOT NULL DEFAULT false,
    "fsp" BOOLEAN NOT NULL DEFAULT false,
    "nisi" DOUBLE PRECISION,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION,
    "nationalPromo" BOOLEAN NOT NULL DEFAULT false,
    "localPromo" BOOLEAN NOT NULL DEFAULT false,
    "fsp" BOOLEAN NOT NULL DEFAULT false,
    "nisi" DOUBLE PRECISION,
    "commissionRate" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "estMonthly" DOUBLE PRECISION,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportVisit" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" TEXT,
    "userAgent" TEXT,
    "visitNumber" INTEGER NOT NULL,

    CONSTRAINT "ReportVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionView" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "secondsViewed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SectionView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL DEFAULT 'registration',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotThread" (
    "id" TEXT NOT NULL,
    "ghlContactId" TEXT NOT NULL,
    "botType" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotLock" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "label" TEXT,
    "zone" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "normalized" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "leadId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_repSlug_key" ON "User"("repSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_guideSlug_key" ON "Lead"("guideSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SrLead_leadId_key" ON "SrLead"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SrLead_ghlContactId_key" ON "SrLead"("ghlContactId");

-- CreateIndex
CREATE INDEX "SrLead_ghlContactId_idx" ON "SrLead"("ghlContactId");

-- CreateIndex
CREATE INDEX "SrLead_leadId_idx" ON "SrLead"("leadId");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_idx" ON "LeadNote"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_reportUuid_key" ON "Inspection"("reportUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_inspectionId_key" ON "Quote"("inspectionId");

-- CreateIndex
CREATE INDEX "RegistrationCode_email_idx" ON "RegistrationCode"("email");

-- CreateIndex
CREATE INDEX "RegistrationCode_email_purpose_idx" ON "RegistrationCode"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_deviceToken_key" ON "TrustedDevice"("deviceToken");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "TrustedDevice_deviceToken_idx" ON "TrustedDevice"("deviceToken");

-- CreateIndex
CREATE UNIQUE INDEX "BotThread_ghlContactId_botType_key" ON "BotThread"("ghlContactId", "botType");

-- CreateIndex
CREATE UNIQUE INDEX "SlotLock_leadId_key" ON "SlotLock"("leadId");

-- CreateIndex
CREATE INDEX "SlotLock_date_zone_idx" ON "SlotLock"("date", "zone");

-- CreateIndex
CREATE INDEX "SlotLock_expiresAt_idx" ON "SlotLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookLog_idempotencyKey_key" ON "WebhookLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookLog_source_idx" ON "WebhookLog"("source");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_setterUserId_fkey" FOREIGN KEY ("setterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SrLead" ADD CONSTRAINT "SrLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facet" ADD CONSTRAINT "Facet_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportVisit" ADD CONSTRAINT "ReportVisit_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionView" ADD CONSTRAINT "SectionView_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ReportVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

