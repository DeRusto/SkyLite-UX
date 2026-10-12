-- The fork's Google Calendar and Google Photos integrations were removed.
-- Their saved connections can no longer load (their code and tokens are gone)
-- and would leave Settings stuck on "Initializing integration services...".
-- Users linked to one fall back to no calendar via ON DELETE SET NULL.
DELETE FROM "integrations" WHERE "service" IN ('google-calendar', 'google-photos');
