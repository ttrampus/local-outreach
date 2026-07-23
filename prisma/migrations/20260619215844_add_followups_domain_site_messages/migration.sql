-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "customDomain" TEXT;
ALTER TABLE "Lead" ADD COLUMN "repliedAt" DATETIME;

-- AlterTable
ALTER TABLE "Outreach" ADD COLUMN "scheduledAt" DATETIME;

-- CreateTable
CREATE TABLE "SiteMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SiteMessage_leadId_idx" ON "SiteMessage"("leadId");
