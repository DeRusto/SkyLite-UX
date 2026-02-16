-- AlterTable
ALTER TABLE "screensaver_settings" ADD COLUMN "selectedPhotoSource" TEXT;

-- CreateTable
CREATE TABLE "photo_cache" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_start_idx" ON "calendar_events"("start");

-- CreateIndex
CREATE INDEX "calendar_events_end_idx" ON "calendar_events"("end");

-- CreateIndex
-- CreateIndex
CREATE UNIQUE INDEX "photo_cache_integrationId_assetId_size_key" ON "photo_cache"("integrationId", "assetId", "size");
