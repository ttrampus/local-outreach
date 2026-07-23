-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google',
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "rating" REAL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'COLD',
    "score" INTEGER NOT NULL DEFAULT 0,
    "qualificationReason" TEXT,
    "signals" TEXT,
    "previewImagePath" TEXT,
    "previewHtmlPath" TEXT,
    "deployedUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "previewViews" INTEGER NOT NULL DEFAULT 0,
    "firstViewedAt" DATETIME,
    "lastViewedAt" DATETIME,
    "interestedAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "searchRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("address", "createdAt", "deployedUrl", "id", "name", "phone", "photoCount", "placeId", "previewHtmlPath", "previewImagePath", "qualificationReason", "rating", "reviewCount", "score", "searchRunId", "signals", "source", "status", "tier", "updatedAt", "website") SELECT "address", "createdAt", "deployedUrl", "id", "name", "phone", "photoCount", "placeId", "previewHtmlPath", "previewImagePath", "qualificationReason", "rating", "reviewCount", "score", "searchRunId", "signals", "source", "status", "tier", "updatedAt", "website" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_placeId_key" ON "Lead"("placeId");
CREATE INDEX "Lead_tier_idx" ON "Lead"("tier");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE TABLE "new_Outreach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "contact" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Outreach_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Outreach" ("body", "channel", "contact", "createdAt", "id", "leadId", "sentAt", "status", "subject", "updatedAt") SELECT "body", "channel", "contact", "createdAt", "id", "leadId", "sentAt", "status", "subject", "updatedAt" FROM "Outreach";
DROP TABLE "Outreach";
ALTER TABLE "new_Outreach" RENAME TO "Outreach";
CREATE INDEX "Outreach_leadId_idx" ON "Outreach"("leadId");
CREATE INDEX "Outreach_status_idx" ON "Outreach"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
