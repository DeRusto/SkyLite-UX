-- Add calendar categorization fields to household_settings
ALTER TABLE "household_settings" ADD COLUMN "linkedCalendars" JSONB;
ALTER TABLE "household_settings" ADD COLUMN "holidayColor" TEXT;
ALTER TABLE "household_settings" ADD COLUMN "familyColor" TEXT;
