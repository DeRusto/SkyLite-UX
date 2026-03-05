# Security Audit Report: SkyLite-UX

**Audit Date:** February 21, 2026
**Scope:** SkyLite-UX Nuxt 4 Application
**Focus Areas:** Environment variables, authentication, authorization, SQL injection, XSS, API security, CORS, and credential handling

---

## Executive Summary

The SkyLite-UX codebase demonstrates **good foundational security practices** with several commendable features:
- ✅ Uses Prisma ORM (prevents SQL injection)
- ✅ No `v-html` or dangerous HTML injection patterns in Vue templates
- ✅ Proper use of Nuxt runtime config (avoids direct `process.env` access)
- ✅ Encryption of OAuth tokens (AES-256-GCM)
- ✅ .env files properly gitignored
- ✅ No raw SQL queries (`queryRaw`, `executeRaw`)

However, **critical security concerns** have been identified that require immediate remediation, particularly around **OAuth token transmission security** and **missing API authentication middleware**.

---

## Critical Issues (Must Fix)

### 1. ⛔ CRITICAL: OAuth Tokens Exposed in URL Parameters

**Severity:** CRITICAL
**Location:**
- `/server/api/integrations/google-calendar/oauth/callback.get.ts` (lines 39-43)
- `/server/api/integrations/google-photos/oauth/callback.get.ts` (lines 37-41)

**Issue:** After exchanging the authorization code for tokens, the OAuth callback redirects to the settings page with **plaintext OAuth tokens in URL parameters**:

```typescript
const redirectUrl = `/settings?oauth_success=true`
  + `&service=google-calendar`
  + `&access_token=${encodeURIComponent(tokenInfo.accessToken)}`
  + `&refresh_token=${encodeURIComponent(tokenInfo.refreshToken)}`
  + `&token_expiry=${tokenInfo.expiryDate}`;

return sendRedirect(event, redirectUrl);
```

**Security Impact:**
- Tokens appear in browser history, referrer headers, and server logs
- A malicious actor who gains access to logs or browser history can impersonate the user
- Tokens are transmitted unencrypted (even over HTTPS, they're exposed in URL)
- Third-party services in the chain may log or cache URLs

**Fix:** Use `POST` request with request body instead of URL parameters, or use a secure redirect mechanism with a one-time token.

```typescript
// OPTION 1: Use secure POST form with hidden inputs
// Return an HTML form that auto-submits with tokens in POST body

// OPTION 2: One-time token approach
// 1. Store tokens server-side with a unique one-time token
// 2. Pass only the one-time token in URL
// 3. Frontend retrieves tokens using the one-time token
```

---

### 2. ⛔ CRITICAL: Missing API Authentication Middleware

**Severity:** CRITICAL
**Location:** All API routes in `/server/api/` lack authentication verification

**Issue:** API routes are completely open - no middleware validates that requests are coming from an authenticated user. Examples:

- `/server/api/calendar-events/index.post.ts` - Creates events without auth
- `/server/api/chores/index.post.ts` - Creates chores without auth
- `/server/api/users/index.post.ts` - Creates users without auth
- `/server/api/integrations/index.post.ts` - Saves OAuth credentials without auth

**Security Impact:**
- **Complete takeover possible** - anyone with network access can create, update, or delete all data
- Unauthenticated users can add integrations and harvest API keys
- In a family/household context, any device on the network can modify all data
- No audit trail of who made changes

**Fix:** Implement authentication middleware (examples below)

```typescript
// Create middleware at: /server/middleware/01.auth.ts
export default defineEventHandler((event) => {
  // Skip auth for public routes
  const publicRoutes = ['/api/integrations/google-calendar/oauth/authorize', '/api/integrations/google-photos/oauth/authorize'];
  if (publicRoutes.some(route => event.node.req.url?.startsWith(route))) {
    return;
  }

  // All other routes require authentication
  // For a single-household app, implement session-based auth or a simple shared secret
  const authToken = getHeader(event, 'authorization');
  if (!authToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  // Validate token (implement your strategy)
  validateToken(authToken);
});
```

**Note:** Since SkyLite-UX is a family app without traditional user authentication, consider:
- Simple session-based auth for the household
- Device-based authentication
- Shared secret approach (password per household)
- Network-level controls (restrict to LAN)

---

### 3. ⛔ CRITICAL: CORS Allows All Origins

**Severity:** CRITICAL
**Location:** `/server/api/sync/events.get.ts` (line 12)

**Issue:**
```typescript
setResponseHeaders(event, {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",  // ← Allows any origin
  "Access-Control-Allow-Headers": "Cache-Control",
});
```

**Security Impact:**
- Any website can open a connection to your SkyLite instance and receive real-time sync updates
- Enables CSRF attacks to your API endpoints
- Exposes integration sync data to external origins

**Fix:** Restrict to localhost or specific domains
```typescript
setResponseHeaders(event, {
  "Access-Control-Allow-Origin": "http://localhost:3000", // or your actual domain
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
});
```

---

## High-Risk Issues (Should Fix Soon)

### 4. ⚠️ HIGH: Plaintext API Keys Stored in Database

**Severity:** HIGH
**Location:** `/server/api/integrations/index.post.ts` (lines 125-131)

**Issue:** Tandoor, Mealie, and other integration API keys are stored **without encryption**:

```typescript
const integration = await prisma.integration.create({
  data: {
    apiKey,         // ← Stored plaintext
    baseUrl,        // ← Stored plaintext
    // ...
  },
});
```

While OAuth tokens are encrypted (Google Calendar, Google Photos), third-party API keys for Tandoor, Mealie, Immich, and OpenWeatherMap are stored as plaintext.

**Security Impact:**
- Database compromise exposes all third-party credentials
- Attacker can access user's Tandoor recipes, shopping lists, photo library, etc.
- No protection if database backup is leaked

**Fix:** Encrypt all API keys using the same AES-256-GCM approach:

```typescript
// server/utils/secretsEncryption.ts
export function encryptSecret(secret: string): string {
  // Use same pattern as oauthCrypto.ts
}

export function decryptSecret(encrypted: string): string {
  // Use same pattern as oauthCrypto.ts
}

// In integrations/index.post.ts
const encryptedApiKey = apiKey ? encryptSecret(apiKey) : null;
const integration = await prisma.integration.create({
  data: {
    apiKey: encryptedApiKey,
    baseUrl, // Consider encrypting this too
    // ...
  },
});
```

Then decrypt when needed:

```typescript
// In tandoor/[...path].ts
const apiKey = integration.apiKey ? decryptSecret(integration.apiKey) : null;
if (apiKey) {
  headers.Authorization = `Bearer ${apiKey}`;
}
```

---

### 5. ⚠️ HIGH: Plaintext PIN Stored in Database

**Severity:** HIGH
**Location:** `/server/api/users/verifyPin.post.ts` (line 46-47)

**Issue:** The code attempts to handle migration of plaintext PINs to hashed PINs, but it reveals the current state:

```typescript
// Migration: If verification failed, check if it's a legacy plaintext PIN
if (!isValid && settings.adultPin === pin) {
  isValid = true;
  // Upgrade to hashed PIN
  const hashed = await hashPin(pin);
  await prisma.householdSettings.update({
    where: { id: settings.id },
    data: { adultPin: hashed },
  });
}
```

This suggests some PINs may still be stored plaintext in existing deployments.

**Security Impact:**
- Database compromise exposes household PINs
- Adult PINs can be extracted without hashing

**Fix:**
1. Enforce that ALL PINs are hashed at database schema level
2. Ensure migration script runs on startup to hash any plaintext PINs
3. Add validation that prevents plaintext PIN storage

```typescript
// Prevent plaintext PIN storage
if (pin && pin.length === 4 && /^\d+$/.test(pin)) {
  throw new Error("PIN must be hashed before storage");
}
```

---

## Medium-Risk Issues (Should Address)

### 6. ⚠️ MEDIUM: Tokens Passed in Query Parameters

**Severity:** MEDIUM
**Location:** `/server/api/integrations/google-calendar/calendars.get.ts` (lines 12-17)

**Issue:** The function accepts OAuth tokens via URL query parameters:

```typescript
const accessToken = getHeader(event, "x-access-token") || (query.accessToken as string);
const refreshToken = getHeader(event, "x-refresh-token") || (query.refreshToken as string);
const tokenExpiryHeader = getHeader(event, "x-token-expiry");
const tokenExpiry = tokenExpiryHeader
  ? new Date(Number(tokenExpiryHeader))
  : (query.tokenExpiry ? new Date(Number(query.tokenExpiry)) : null);
```

While headers are preferred (good!), fallback to query parameters is a security weakness.

**Security Impact:**
- Tokens in query parameters are logged in server logs, browser history, CDN caches
- Referrer headers expose tokens to third-party sites

**Fix:** Remove query parameter fallback and require headers-only:

```typescript
const accessToken = getHeader(event, "x-access-token");
const refreshToken = getHeader(event, "x-refresh-token");
const tokenExpiryHeader = getHeader(event, "x-token-expiry");

if (!accessToken || !refreshToken || !tokenExpiryHeader) {
  throw createError({
    statusCode: 400,
    message: "OAuth tokens must be provided via headers (x-access-token, x-refresh-token, x-token-expiry)",
  });
}
```

---

### 7. ⚠️ MEDIUM: Weak PIN Validation

**Severity:** MEDIUM
**Location:** `/server/api/users/verifyPin.post.ts` (line 8)

**Issue:**
```typescript
const verifyPinSchema = z.object({
  userId: z.string().cuid(),
  pin: z.string().length(4).regex(/^\d+$/),
});
```

PIN validation only checks:
- Exactly 4 digits
- No rate limiting on verification attempts
- No lockout after failed attempts

**Security Impact:**
- Brute force attack: only 10,000 possible PINs (0000-9999)
- No protection against automated attacks
- In theory, 4-digit PIN can be cracked in seconds with 10 requests/second

**Fix:** Implement rate limiting and account lockout

```typescript
const verifyPinSchema = z.object({
  userId: z.string().cuid(),
  pin: z.string().length(4).regex(/^\d+$/),
});

// Add rate limiting middleware
const pinAttempts = new Map<string, { count: number; lockedUntil: Date }>();

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, pin } = await verifyPinSchema.parseAsync(body);

  // Check rate limit
  const attempt = pinAttempts.get(userId);
  if (attempt && attempt.lockedUntil > new Date()) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many attempts. Please try again later.",
    });
  }

  // ... verify PIN logic ...

  // On failure, increment counter
  if (!isValid) {
    const current = pinAttempts.get(userId) || { count: 0, lockedUntil: new Date() };
    current.count++;
    if (current.count >= 5) {
      current.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
    }
    pinAttempts.set(userId, current);
  }
});
```

---

### 8. ⚠️ MEDIUM: No Input Validation on Reorder Operations

**Severity:** MEDIUM
**Location:**
- `/server/api/shopping-list-items/reorder.post.ts`
- `/server/api/todos/reorder.post.ts`
- `/server/api/calendar-events/[id].put.ts`

**Issue:** Reorder operations accept arrays of items with order positions but don't validate:
- User owns these items
- Order indices are sequential and non-negative
- Array is not excessively large

**Example from `/server/api/todos/reorder.post.ts`:**
```typescript
const { updates } = body; // No validation on structure or count
await prisma.$transaction(updates);
```

**Security Impact:**
- Potential integer overflow with large order values
- Possible to update items belonging to other users
- No protection against bulk manipulation

**Fix:** Add input validation

```typescript
const reorderSchema = z.object({
  updates: z.array(z.object({
    id: z.string().cuid(),
    order: z.number().int().nonnegative().max(10000),
  })).max(1000), // Limit array size
});

const { updates } = await reorderSchema.parseAsync(body);
```

---

### 9. ⚠️ MEDIUM: Proxy Route for Tandoor Lacks Input Validation

**Severity:** MEDIUM
**Location:** `/server/api/integrations/tandoor/[...path].ts` (lines 57-79)

**Issue:**
```typescript
const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;
const url = `${baseUrl}/api/${path}${Object.keys(restQuery).length ? `?${new URLSearchParams(restQuery as Record<string, string>).toString()}` : ""}`;

// Directly proxies to external Tandoor API
const response = await fetch(fixedUrl, {
  method,
  headers,
  body: body ? JSON.stringify(body) : undefined,
});
```

**Security Impact:**
- No validation on path parameters - can potentially access unintended Tandoor endpoints
- Query parameters passed directly - possibility of parameter injection
- Entire request body proxied without validation
- No rate limiting on proxy requests

**Fix:** Whitelist allowed Tandoor endpoints

```typescript
const ALLOWED_TANDOOR_ENDPOINTS = [
  "shopping-list-entry",
  "shopping-list",
  "food",
  "unit",
];

const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;
const firstSegment = path.split("/")[0];

if (!ALLOWED_TANDOOR_ENDPOINTS.includes(firstSegment)) {
  throw createError({
    statusCode: 403,
    statusMessage: `Access to Tandoor endpoint "${firstSegment}" is not allowed`,
  });
}
```

---

## Low-Risk Issues (Best Practices)

### 10. ℹ️ LOW: Error Messages May Expose System Details

**Severity:** LOW
**Location:** Multiple API routes

**Issue:** Error responses include detailed implementation information:

```typescript
catch (error: unknown) {
  consola.error("Integrations Tandoor: Error proxying request to Tandoor:", error);
  throw createError({
    statusCode: 500,
    statusMessage: `Tandoor API error: ${response.status} ${response.statusText} - ${errorText}`,
  });
}
```

**Recommendation:** In production, sanitize error messages to avoid exposing internal details:

```typescript
catch (error: unknown) {
  consola.error("Integrations Tandoor: Error proxying request:", error);
  const isDev = import.meta.dev;
  const message = isDev ? error instanceof Error ? error.message : String(error) : "Integration request failed";
  throw createError({
    statusCode: 500,
    statusMessage: message,
  });
}
```

---

### 11. ℹ️ LOW: Encryption Key Requires 64-Char Hex String

**Severity:** LOW
**Location:** `/server/utils/oauthCrypto.ts` (lines 9-29)

**Issue:** The encryption key validation is correct, but the .env.example documentation could be clearer:

```
# Generate with: openssl rand -hex 32
NUXT_OAUTH_ENCRYPTION_KEY=""
```

This is good! But it would help to show the actual output format:

```
# Generate with: openssl rand -hex 32
# Output will be 64 hex characters (e.g., a1b2c3d4...)
NUXT_OAUTH_ENCRYPTION_KEY="a1b2c3d4e5f6..."
```

---

## Environment Variable Configuration Review

### ✅ Strengths:
1. **Proper use of `NUXT_` prefix** - All sensitive config uses runtime config
2. **No hardcoded secrets** - No secrets found in source code
3. **`.env` properly gitignored** - `.env*` excluded, `.env.example` included
4. **.env.example is comprehensive** - Includes all required variables with documentation
5. **Nuxt config properly structured** - Sensitive vars in `runtimeConfig`, public vars in `runtimeConfig.public`

### Example of Good Practice:
```typescript
// nuxt.config.ts
runtimeConfig: {
  oauthEncryptionKey: "",        // Secret, server-only
  googleClientSecret: "",         // Secret, server-only
  public: {
    tz: "America/Chicago",        // Public
  },
},
```

---

## Database Security Review

### ✅ Strengths:
1. **Prisma ORM prevents SQL injection** - No raw queries found (`queryRaw`, `executeRaw`)
2. **Parameterized queries** - All database access uses Prisma's type-safe API
3. **Foreign key constraints** - Schema enforces relationships

### ⚠️ Areas for Improvement:
1. **Missing field-level encryption** - Sensitive integration credentials not encrypted (see Issue #4)
2. **No audit logging** - No tracking of who accessed what data
3. **No soft deletes** - Deleted data is permanently removed (consider adding `deletedAt` for audit trail)

---

## Recommendations Summary

### Immediate (Critical):
1. **Remove OAuth tokens from URL parameters** - Use POST body or one-time token approach
2. **Implement API authentication middleware** - Protect all routes with auth verification
3. **Fix CORS configuration** - Remove `Access-Control-Allow-Origin: "*"`

### High Priority:
4. **Encrypt all API keys** - Apply AES-256-GCM encryption to Tandoor, Mealie, Immich keys
5. **Ensure PINs are always hashed** - Add schema validation and migration
6. **Remove query parameter token fallback** - Headers-only for sensitive data

### Medium Priority:
7. **Implement PIN rate limiting** - Prevent brute force attacks
8. **Add input validation to reorder operations** - Validate ownership and array bounds
9. **Whitelist Tandoor proxy endpoints** - Prevent unintended API access
10. **Sanitize error messages in production** - Avoid exposing implementation details

---

## Testing Recommendations

1. **OAuth Flow Testing**
   - Verify tokens are not exposed in browser history
   - Check server logs don't contain plaintext tokens
   - Test redirect handling with missing/invalid codes

2. **API Authentication Testing**
   - Verify unauthenticated requests are rejected
   - Test that users can only access their own household data
   - Attempt to create/modify data without auth token

3. **Encryption Testing**
   - Verify database doesn't contain plaintext secrets
   - Test that invalid encryption keys cause proper errors
   - Verify key rotation procedures (if implemented)

4. **Input Validation Testing**
   - Test reorder with invalid array sizes
   - Test PIN with non-numeric values
   - Test Tandoor proxy with disallowed endpoints

---

## Compliance Checklist

- [ ] API authentication middleware implemented
- [ ] OAuth tokens removed from URL parameters
- [ ] CORS origin restriction applied
- [ ] API keys encrypted at rest
- [ ] PINs enforced as hashed
- [ ] PIN rate limiting implemented
- [ ] Input validation on bulk operations
- [ ] Tandoor proxy whitelisting
- [ ] Error messages sanitized in production
- [ ] Security headers configured
- [ ] Rate limiting on sensitive endpoints
- [ ] Audit logging for critical operations

---

## References & Standards

- OWASP Top 10 2024: https://owasp.org/www-project-top-ten/
- Secure Coding Practices: https://cheatsheetseries.owasp.org/
- Nuxt Security: https://nuxt.com/docs/guide/security
- PostgreSQL Security: https://www.postgresql.org/docs/current/sql-syntax.html

---

**Next Steps:**
1. Address critical issues immediately
2. Schedule review of high-priority items
3. Implement testing recommendations
4. Document security procedures for team
5. Schedule quarterly security audits

