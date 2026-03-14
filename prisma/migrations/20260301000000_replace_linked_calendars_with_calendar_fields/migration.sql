-- Drop the old linkedCalendars column that was replaced by separate fields
ALTER TABLE "users" DROP COLUMN IF EXISTS "linkedCalendars";

-- Add new calendar fields to users table
ALTER TABLE "users" ADD COLUMN     "calendarId" TEXT;
ALTER TABLE "users" ADD COLUMN     "calendarIntegrationId" TEXT;
ALTER TABLE "users" ADD COLUMN     "calendarService" TEXT;

-- CreateIndex
CREATE INDEX "users_calendarIntegrationId_idx" ON "users"("calendarIntegrationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
