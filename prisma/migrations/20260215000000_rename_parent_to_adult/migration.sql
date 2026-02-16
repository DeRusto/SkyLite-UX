-- AlterEnum
ALTER TYPE "UserRole" RENAME VALUE 'ADULT' TO 'ADULT';

-- AlterEnum
ALTER TYPE "ChoreCompletionMode" RENAME VALUE 'ADULT_VERIFY' TO 'ADULT_VERIFY';

-- AlterTable
ALTER TABLE "household_settings" RENAME COLUMN "adultPin" TO "adultPin";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pin" TEXT;
