# Security & Integration Review Findings

## Critical Security Issues

### 1. Plaintext PIN Comparison at server/api/users/verifyPin.post.ts:33
- **Risk**: User PIN verification uses direct string comparison (`settings.parentPin === pin`) instead of secure comparison, allowing timing attacks. The stored PIN is compared in plaintext without hash verification.
- **Severity**: High
- **Evidence**: Line 33 shows `const isValid = settings.parentPin === pin;` with no hash-based verification
- **Recommendation**: Use the `verifyPin()` function (from security.ts) for all PIN verification, ensuring hashed comparison with timing-safe equal. This endpoint needs the same migration logic as household/verifyPin.post.ts.

### 2. Timing Attack Vulnerability - PIN Migration at server/api/household/verifyPin.post.ts:30
- **Risk**: The migration fallback `if (!isValid && settings.parentPin === body.pin)` performs plaintext comparison after failed hash verification, creating a timing attack window. A fixed-time comparison should be used instead.
- **Severity**: High
- **Evidence**: Lines 26-31 show verification followed by plaintext fallback comparison
- **Recommendation**: Use timing-safe comparison for the plaintext migration check. Replace line 30 with a timing-safe constant-time comparison, or move migration to a separate admin-only endpoint.

### 3. Multiple PrismaClient Instantiations
- **Risk**: Direct `new PrismaClient()` instantiations in multiple API handlers cause connection pool exhaustion, memory leaks, and potential database connection saturation under load.
- **Files affected**:
  - server/api/integrations/tandoor/[...path].ts:5
  - server/api/integrations/iCal/index.get.ts:7
  - server/api/integrations/index.post.ts:7
  - server/api/integrations/[id].put.ts:7
  - server/api/integrations/home-assistant/weather/forecast.get.ts:67
  - server/api/integrations/mealie/[...path].ts:5
- **Severity**: High
- **Recommendation**: Import singleton from `~/lib/prisma` instead of instantiating new clients. Replace all occurrences with: `import prisma from "~/lib/prisma";`

### 4. Home Assistant API Key Exposed in Plaintext at server/api/integrations/home-assistant/weather/current.get.ts:64-65
- **Risk**: Home Assistant API key is passed via URL query parameters and logs. Query parameters are logged in access logs, cached by intermediaries, and visible in browser history. No encryption of stored credentials.
- **Severity**: Critical
- **Evidence**: Lines 64-65 show `const baseUrl = query.baseUrl as string; const apiKey = query.apiKey as string;`
- **Recommendation**: Never pass secrets via URL parameters. Store in database encrypted (like OAuth tokens). Fetch integration config from database by integrationId only. Use encrypted storage like other integrations (Google Calendar uses AES-256-GCM).

### 5. Home Assistant API Key in URL at server/api/integrations/home-assistant/weather/forecast.get.ts:66 & 101
- **Risk**: API key retrieved from query params and used in POST to external service. Additional risk: user-controlled `entityId` parameter at line 109 in request body could enable Server-Side Request Forgery (SSRF) if not validated.
- **Severity**: Critical
- **Evidence**: Line 66 shows query parameter extraction; line 101 shows API call with user-supplied targetEntityId
- **Recommendation**: Store Home Assistant credentials encrypted in database. Validate entityId against a whitelist of allowed entities. Remove query-parameter-based auth.

### 6. Unencrypted API Keys for Non-OAuth Integrations at server/api/integrations/immich/albums.get.ts:74
- **Risk**: Mealie and Tandoor API keys stored in plaintext in database (line 61 shows `integration.apiKey` without encryption). OAuth tokens use AES-256-GCM, but basic auth credentials do not, creating inconsistent security posture.
- **Severity**: High
- **Evidence**: Line 74 attempts decryption with fallback to plaintext: `apiKey = decryptToken(storedApiKey); catch { apiKey = storedApiKey; }`
- **Recommendation**: Encrypt all API keys with AES-256-GCM (same as OAuth tokens). Implement migrations to encrypt existing plaintext keys.

---

## Integration & Error Handling Issues

### 7. No Request Timeout for External API Calls
- **Risk**: Integration API calls to external services (Mealie, Tandoor, iCal, Immich) lack timeout mechanisms. Slow/unresponsive servers hang requests indefinitely, exhausting server resources and causing cascading failures.
- **Files affected**:
  - server/api/integrations/mealie/[...path].ts:77 (fetch without timeout)
  - server/api/integrations/tandoor/[...path].ts:75 (fetch without timeout)
  - server/api/integrations/iCal/index.get.ts:61 (fetchEventsFromUrl - check client implementation)
  - server/api/integrations/immich/albums.get.ts:83 (fetch without timeout)
  - server/api/integrations/home-assistant/weather/current.get.ts:77 ($fetch without timeout)
  - server/api/integrations/home-assistant/weather/forecast.get.ts:100 ($fetch without timeout)
- **Severity**: High
- **Evidence**: Immich sync.post.ts uses AbortController (lines 1 with 10000ms timeout) but other endpoints do not
- **Recommendation**: Standardize 30-second timeout on all external API calls using AbortController:
  ```typescript
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { signal: controller.signal, ... });
  } finally {
    clearTimeout(timeoutId);
  }
  ```

### 8. Broad Error Messages Exposing Integration Configuration at server/api/integrations/home-assistant/weather/current.get.ts:94-108
- **Risk**: Error messages return exact HTTP status codes and error text from external services (401, 403, 404, 500, 503), leaking information about API structure and misconfiguration to potential attackers.
- **Severity**: Medium
- **Evidence**: Lines 94-108 map Home Assistant API responses with detailed messages like "check your API key" and "check your server URL"
- **Recommendation**: Return generic error messages to clients. Log detailed errors server-side only. Example: `"Integration connection failed (check logs)"` instead of status-specific messages.

### 9. Missing Validation of User-Controlled Redirect Path
- **Risk**: Mealie and Tandoor proxy endpoints construct URLs from user query parameters (path and query string) without validation, potentially enabling SSRF or request smuggling.
- **Files affected**:
  - server/api/integrations/mealie/[...path].ts:58 (path from params), 61 (queryString constructed from user input)
  - server/api/integrations/tandoor/[...path].ts:58 (path from params), 61 (URL constructed from query params)
- **Severity**: Medium
- **Evidence**: Line 58 uses `Array.isArray(pathParts) ? pathParts.join("/") : pathParts;` directly; line 61 passes user query params without validation
- **Recommendation**: Whitelist allowed API paths (e.g., `/api/households/shopping/*`). Reject any path traversal attempts (`../`, encoded nulls). Validate query parameters.

### 10. Unhandled Promise Rejection in Sync Manager at server/plugins/02.syncManager.ts:124-126
- **Risk**: `setInterval` with async function can queue multiple concurrent syncs if previous sync hasn't completed. No `await` on performIntegrationSync(), meaning sync jobs run in parallel without backpressure, overwhelming external APIs.
- **Severity**: Medium
- **Evidence**: Lines 124-126 show `setInterval(async () => { await performIntegrationSync(...); }, config.syncInterval * 60 * 1000);` but no safeguard against concurrent executions
- **Recommendation**: Track in-flight sync operations. Skip interval tick if previous sync still running:
  ```typescript
  let syncing = false;
  const interval = setInterval(async () => {
    if (syncing) return;
    syncing = true;
    try {
      await performIntegrationSync(...);
    } finally {
      syncing = false;
    }
  }, ...);
  ```

### 11. Missing Fetch Timeout in Google Calendar Client at server/integrations/google-calendar/client.ts
- **Risk**: Token refresh and API calls lack timeout mechanisms. If Google servers are slow/unreachable, requests hang indefinitely.
- **Severity**: Medium
- **Evidence**: Lines 109 and 159 use `oauth2Client.refreshAccessToken()` and calendar API calls without explicit timeouts
- **Recommendation**: Set a 20-second timeout on Google API client initialization. Use AbortController for fetch-based operations or configure the Google Auth library with timeout options.

---

## Best Practice Violations

### 12. Inconsistent Input Validation Approach
- **Risk**: Mix of ad-hoc validation (string checks) and missing schema validation across endpoints. No Zod/Joi schemas for most POST/PUT handlers, making validation fragile and inconsistent.
- **Files affected**:
  - server/api/calendar-events/index.post.ts:8 (minimal validation, no schema)
  - server/api/chores/index.post.ts:8 (manual type checking)
  - server/api/rewards/[id]/redeem.post.ts:9 (manual string checks)
- **Severity**: Medium
- **Evidence**: Line 8 in calendar-events checks `!title || typeof title !== "string"` manually; users/verifyPin.post.ts uses Zod schema (line 5-8), but most don't
- **Recommendation**: Use Zod for all request body/query validation. Create reusable schemas for common fields (IDs, emails, dates, enums).

### 13. Transaction Scope Issues in Reward Redemption at server/api/rewards/[id]/redeem.post.ts:71-110
- **Risk**: Transaction is used correctly here, but the pattern creates complex nested conditionals. More critically: no idempotency handling if redemption request is retried (client-side retry could create duplicate redemptions).
- **Severity**: Low
- **Evidence**: Lines 71-110 use transaction but no idempotency key or deduplication
- **Recommendation**: Add idempotency key support (client provides unique key, server caches results by key for 24 hours).

### 14. Console.error in Production Code at server/integrations/google-calendar/client.ts:66
- **Risk**: Uses `console.error()` instead of logger (consola), violating logging standard. Found in multiple places.
- **Severity**: Low
- **Evidence**: Line 66 and line 42 in verifyPin.post.ts show `console.error("Failed to migrate PIN:", error);`
- **Recommendation**: Replace all `console.error/warn/log` with `consola.error/warn/debug`.

### 15. Weak Authorization Check for Chore Verification at server/api/chores/[id]/verify.post.ts:45-49
- **Risk**: Only checks if verifier is PARENT role, but doesn't verify parent is part of the same household. A parent from a different family instance could verify another family's chores if they guess the completion ID.
- **Severity**: Medium
- **Evidence**: Lines 45-49 check `verifier.role !== "PARENT"` but no household validation
- **Recommendation**: Add `where: { id: body.verifiedByUserId, householdId: currentHouseholdId }` (assuming multi-tenancy schema has householdId on User).

### 16. Missing Rate Limiting on Authentication Endpoints
- **Risk**: PIN verification endpoints (household/verifyPin.post.ts, users/verifyPin.post.ts) lack rate limiting, allowing brute force attacks. No mention of rate-limiting middleware in nuxt.config.ts or API handler middleware.
- **Severity**: Medium
- **Evidence**: Both endpoints accept any request without throttling
- **Recommendation**: Implement rate limiting (e.g., 5 failed attempts per 5 minutes). Use h3 middleware or a library like `h3-rate-limiter`.

### 17. Sensitive Data Logged in Sync Manager at server/plugins/02.syncManager.ts:115, 153
- **Risk**: Integration names and IDs logged in debug/info messages. If logs are exposed or aggregated, this reveals system structure.
- **Severity**: Low
- **Evidence**: Lines 115 and 153 log `integration.name` and `integration.id`
- **Recommendation**: Use integration IDs only in logs (not friendly names). Mask sensitive details in production.

### 18. No CSRF Protection on State-Changing Endpoints
- **Risk**: API endpoints that modify state (POST, PUT, DELETE) lack CSRF tokens or SameSite cookie validation (if sessions are used). OAuth flows use state parameter correctly, but native endpoints don't.
- **Severity**: Medium
- **Evidence**: POST /api/calendar-events/index.post.ts and others have no CSRF check; household/verifyPin.post.ts doesn't validate request origin
- **Recommendation**: Enforce SameSite=Strict on session cookies; validate Origin header for cross-origin requests; or implement CSRF token validation if session-based auth is used.

### 19. Over-Permissive Error Context in catch Blocks
- **Risk**: Catch blocks re-throw error details to clients (e.g., `error instanceof Error ? error.message : ...`), potentially exposing stack traces or sensitive implementation details.
- **Files affected**:
  - server/api/chores/[id]/verify.post.ts:209-211
  - server/api/calendar-events/index.post.ts:90
  - server/api/integrations/google-calendar/events/[id].delete.ts:110
- **Severity**: Low
- **Evidence**: Line 110 in google-calendar delete uses `error.message` directly in response
- **Recommendation**: Log full error server-side, return generic message to client: `"Operation failed. Please try again later."`

### 20. No Validation of Date/Time Formats
- **Risk**: Calendar events accept arbitrary date strings (line 25-26 in calendar-events/index.post.ts). Invalid Date objects are silently coerced, leading to unexpected behavior.
- **Severity**: Low
- **Evidence**: `const utcStart = new Date(start);` with no validation of `start` format
- **Recommendation**: Use Zod's `.datetime()` validator or explicitly validate ISO 8601 format before creating Date objects.

---

## Summary by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| **Critical** | 2 | Home Assistant API keys in plaintext (plaintext auth, query params) |
| **High** | 5 | Timing attack in PIN verification, multiple PrismaClient, plaintext API keys, no request timeouts |
| **Medium** | 8 | Broad error messages, user-controlled redirect paths, sync concurrency, weak authorization, missing rate limiting, CSRF, error details, date validation |
| **Low** | 5 | Console vs consola, sensitive data in logs, idempotency, over-permissive errors |

---

## Remediation Priority

1. **Immediate (this sprint)**:
   - Fix Home Assistant API key handling (move to database encryption)
   - Replace all `new PrismaClient()` with singleton import
   - Add request timeouts to all external API calls (30-second standard)

2. **High Priority (next sprint)**:
   - Fix PIN comparison timing attacks
   - Implement rate limiting on auth endpoints
   - Add Zod validation schemas to all API endpoints
   - Fix weak authorization checks (household isolation)

3. **Medium Priority**:
   - Implement CSRF protection
   - Add idempotency support to state-changing operations
   - Improve error messages (generic client responses)
   - Fix sync manager concurrency
