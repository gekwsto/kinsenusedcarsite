/*
  Warnings:

  - Made the column `versionName` on table `Vehicle` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill existing rows that predate versionName from model, so the NOT NULL constraint below can be applied.
UPDATE "Vehicle" SET "versionName" = "model" WHERE "versionName" IS NULL;

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "versionName" SET NOT NULL;
