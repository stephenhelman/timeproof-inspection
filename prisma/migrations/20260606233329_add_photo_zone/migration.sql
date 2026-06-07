-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "zone" TEXT;
