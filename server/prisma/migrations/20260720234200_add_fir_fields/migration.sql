-- AlterTable
ALTER TABLE "Fir" ADD COLUMN     "complainantContact" TEXT,
ADD COLUMN     "incidentTime" TEXT,
ADD COLUMN     "crimeCategory" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Registered';
