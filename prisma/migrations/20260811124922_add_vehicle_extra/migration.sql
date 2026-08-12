-- CreateTable
CREATE TABLE "VehicleExtra" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleExtra_vehicleId_idx" ON "VehicleExtra"("vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleExtra" ADD CONSTRAINT "VehicleExtra_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
