-- AlterEnum
ALTER TYPE "UserRole" RENAME VALUE 'PARENT' TO 'ADULT';

-- AlterEnum
ALTER TYPE "ChoreCompletionMode" RENAME VALUE 'PARENT_VERIFY' TO 'ADULT_VERIFY';

-- AlterTable
ALTER TABLE "household_settings" RENAME COLUMN "parentPin" TO "adultPin";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pin" TEXT;
