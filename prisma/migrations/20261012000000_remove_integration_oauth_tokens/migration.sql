-- The fork's token-based Google Calendar and Google Photos integrations were
-- removed in favour of upstream's settings-based Google Calendar integration,
-- which keeps its tokens in "apiKey" and "settings".

-- Their saved connections can no longer load (their code and tokens are gone)
-- and would leave Settings stuck on "Initializing integration services...".
-- Users linked to one fall back to no calendar via ON DELETE SET NULL.
DELETE FROM "integrations" WHERE "service" IN ('google-calendar', 'google-photos');

-- AlterTable
ALTER TABLE "integrations" DROP COLUMN "accessToken",
DROP COLUMN "refreshToken",
DROP COLUMN "tokenExpiry",
DROP COLUMN "tokenType";
