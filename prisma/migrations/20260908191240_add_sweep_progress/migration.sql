-- CreateTable
CREATE TABLE "SweepProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sweep" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SweepProgress_sweep_query_location_key" ON "SweepProgress"("sweep", "query", "location");
