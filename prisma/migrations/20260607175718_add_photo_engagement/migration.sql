-- CreateTable
CREATE TABLE "PhotoEngagement" (
    "id" TEXT NOT NULL,
    "reportVisitId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "dwellMs" INTEGER NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoEngagement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PhotoEngagement" ADD CONSTRAINT "PhotoEngagement_reportVisitId_fkey" FOREIGN KEY ("reportVisitId") REFERENCES "ReportVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEngagement" ADD CONSTRAINT "PhotoEngagement_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
