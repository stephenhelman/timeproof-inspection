-- Sprint 1: Schema Foundation
-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ALEX', 'JORDAN', 'REP');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('SETTER_FOLLOWUP', 'REP_FOLLOWUP', 'FINANCE_REVIEW', 'ZIP_REVIEW', 'MANUAL_BOOKING', 'ESCALATION');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('BOT', 'GHL_WEBHOOK');

-- DropForeignKey (legacy tables)
ALTER TABLE "Facet" DROP CONSTRAINT "Facet_structureId_fkey";
ALTER TABLE "Package" DROP CONSTRAINT "Package_inspectionId_fkey";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_inspectionId_fkey";
ALTER TABLE "Structure" DROP CONSTRAINT "Structure_inspectionId_fkey";

-- CreateTable Appointment (before data migration and before column drops)
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "assignedUserId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdBy" "AppointmentSource" NOT NULL,
    "ghlCalendarEventId" TEXT,
    "ghlOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Appointment_inspectionId_key" ON "Appointment"("inspectionId");

-- Data migration: preserve existing appointment record
-- Lead cmprv3p5w0000l104w27ynf4k had appointmentDate 2026-01-04T21:00:00Z
-- Its inspection cmprv9ar3000hl104zp909add had the same appointmentAt
-- assignedUser from inspection.userId: cmpekcp010001qukake1zcb59
INSERT INTO "Appointment" (
  "id", "leadId", "inspectionId", "assignedUserId",
  "scheduledAt", "status", "createdBy",
  "createdAt", "updatedAt"
)
SELECT
  'cmigrated_appt_001',
  'cmprv3p5w0000l104w27ynf4k',
  'cmprv9ar3000hl104zp909add',
  'cmpekcp010001qukake1zcb59',
  '2026-01-04 21:00:00'::TIMESTAMP,
  'SCHEDULED'::"AppointmentStatus",
  'REP'::"AppointmentSource",
  NOW(),
  NOW()
WHERE EXISTS (
  SELECT 1 FROM "Lead" WHERE "id" = 'cmprv3p5w0000l104w27ynf4k'
)
AND EXISTS (
  SELECT 1 FROM "Inspection" WHERE "id" = 'cmprv9ar3000hl104zp909add'
)
AND EXISTS (
  SELECT 1 FROM "User" WHERE "id" = 'cmpekcp010001qukake1zcb59'
);

-- AlterTable Inspection: drop deprecated column, add new fields
ALTER TABLE "Inspection" DROP COLUMN "appointmentAt",
ADD COLUMN     "aiDiagnosisDescription" TEXT,
ADD COLUMN     "aiDiagnosisStructured" JSONB,
ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "intakePass1" JSONB,
ADD COLUMN     "intakePass2" JSONB,
ADD COLUMN     "warningSignResponses" JSONB;

-- AlterTable Lead: drop deprecated column
ALTER TABLE "Lead" DROP COLUMN "appointmentDate";

-- AlterTable User: add new fields
ALTER TABLE "User" ADD COLUMN "ghlUserId" TEXT,
ADD COLUMN "staffOnly" BOOLEAN NOT NULL DEFAULT false;

-- DropTable (legacy — all empty, no data loss)
DROP TABLE "Facet";
DROP TABLE "Package";
DROP TABLE "Quote";
DROP TABLE "Structure";
DROP TABLE "VerificationToken";

-- CreateTable Task
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "assignedUserId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "context" TEXT NOT NULL,
    "outcome" TEXT,
    "availableOutcomes" TEXT[],
    "createdBy" "TaskSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_ghlUserId_key" ON "User"("ghlUserId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
