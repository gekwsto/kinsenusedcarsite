-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "submissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_submissionId_key" ON "Lead"("submissionId");
