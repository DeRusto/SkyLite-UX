-- The fork's token-based Google Calendar and Google Photos integrations were
-- removed in favour of upstream's settings-based Google Calendar integration,
-- which keeps its tokens in "apiKey" and "settings".

-- AlterTable
ALTER TABLE "integrations" DROP COLUMN "accessToken",
DROP COLUMN "refreshToken",
DROP COLUMN "tokenExpiry",
DROP COLUMN "tokenType";
