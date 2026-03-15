-- Remove household-level adult PIN in favor of individual user profile PINs
ALTER TABLE "household_settings" DROP COLUMN IF EXISTS "adultPin";
