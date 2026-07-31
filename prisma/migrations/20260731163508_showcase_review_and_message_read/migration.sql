-- AlterTable
ALTER TABLE "Outreach" ADD COLUMN "reviewedAt" DATETIME;

-- AlterTable
ALTER TABLE "SiteMessage" ADD COLUMN "readAt" DATETIME;

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
    "previewMobileImagePath" TEXT,
    "previewHtmlPath" TEXT,
    "previewEngine" TEXT,
    "previewVariant" INTEGER NOT NULL DEFAULT 0,
    "deployedUrl" TEXT,
    "customDomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "previewViews" INTEGER NOT NULL DEFAULT 0,
    "firstViewedAt" DATETIME,
    "lastViewedAt" DATETIME,
    "interestedAt" DATETIME,
    "repliedAt" DATETIME,
    "showcase" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "searchRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("address", "createdAt", "customDomain", "deployedUrl", "email", "firstViewedAt", "id", "interestedAt", "lastViewedAt", "name", "phone", "photoCount", "placeId", "previewEngine", "previewHtmlPath", "previewImagePath", "previewMobileImagePath", "previewVariant", "previewViews", "qualificationReason", "rating", "repliedAt", "reviewCount", "score", "searchRunId", "signals", "source", "status", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "tier", "updatedAt", "website") SELECT "address", "createdAt", "customDomain", "deployedUrl", "email", "firstViewedAt", "id", "interestedAt", "lastViewedAt", "name", "phone", "photoCount", "placeId", "previewEngine", "previewHtmlPath", "previewImagePath", "previewMobileImagePath", "previewVariant", "previewViews", "qualificationReason", "rating", "repliedAt", "reviewCount", "score", "searchRunId", "signals", "source", "status", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus", "tier", "updatedAt", "website" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_placeId_key" ON "Lead"("placeId");
CREATE INDEX "Lead_tier_idx" ON "Lead"("tier");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_showcase_idx" ON "Lead"("showcase");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
