# SkyLite-UX Test Coverage Analysis Report

**Date:** February 21, 2026
**Status:** CRITICAL - No Tests Configured
**Test Framework:** Playwright E2E (configured, but no tests exist)
**Codebase Size:** ~11,265 lines (composables + API routes) | 50 Vue components | 96 API endpoints

---

## Executive Summary

**SkyLite-UX has ZERO test coverage.** The project is configured for Playwright E2E testing but has:

- No test files (`tests/` directory is empty)
- No test suite run on CI/CD
- No unit tests for composables, utilities, or business logic
- No integration tests for API routes
- No E2E tests for critical user workflows

This is a **high-risk situation** for a production family management application. The codebase is growing (recent refactoring commits) without test safeguards.

---

## Test Infrastructure Status

### Playwright Configuration

- **Status:** ✅ Configured
- **Location:** `playwright.config.ts`
- **Test Directory:** `./tests/` (currently empty)
- **Base URL:** `http://localhost:8877`
- **Browsers:** Chromium only (Firefox/Safari commented out)
- **Artifacts:** Screenshots and videos on failure, HTML reports
- **CI Settings:** Retries=2, Sequential execution, forbidOnly=true

### NPM Test Commands

```bash
npm test                              # playwright test (no tests found)
npm run test:ui                       # Playwright UI runner
npm run test:headed                   # Run tests with browser visible
npm run test:settings                 # Run specific regression test (doesn't exist)
```

**Issue:** All commands fail with "Error: No tests found"

---

## Codebase Inventory

### Frontend (Vue 3 + Nuxt 4)

#### Pages (50 Vue components)

1. **Calendar** (`app/pages/calendar.vue`)
   - Two-way Google Calendar sync
   - iCal imports
   - Event creation, editing, deletion
   - User assignment to events
   - Multiple timezone support
   - No tests for sync conflicts, date validation, or race conditions

2. **Chores** (`app/pages/chores.vue`)
   - Create/assign chores
   - Completion workflow with verification
   - Points allocation
   - Reordering functionality
   - No tests for state transitions or permission checks

3. **Rewards** (`app/pages/rewards.vue`)
   - Reward creation
   - Redemption workflow (child requests → adult approves/rejects)
   - Point balance calculations
   - No tests for approval logic or race conditions

4. **Shopping Lists** (`app/pages/shoppingLists.vue`)
   - Multiple list management
   - Item CRUD
   - Integration with Mealie/Tandoor
   - Reordering items
   - No tests for list mutations or integration sync

5. **To-Do Lists** (`app/pages/toDoLists.vue`)
   - Kanban-style columns
   - Task management with user assignment
   - Completion workflows
   - Reordering (both columns and tasks)
   - No tests for drag-and-drop or column state

6. **Meal Planner** (`app/pages/mealPlanner.vue`)
   - Meal planning interface
   - No visible tests

7. **Screensaver** (`app/pages/screensaver.vue`)
   - Photo display (Google Photos, Immich)
   - Weather display
   - Family dashboard view
   - No tests for photo rotation or weather integration

8. **Settings** (`app/pages/settings.vue`)
   - Household configuration
   - User management
   - Integration setup (Google, Mealie, Tandoor, Home Assistant, Immich, OpenWeatherMap)
   - Adult PIN protection
   - No tests for permission checks or integration configuration

#### Composables (18 composables, ~2,000+ lines)

Critical state management composables with **zero tests:**

1. **useCalendarEvents** - Manages all calendar event state, syncing, and optimistic updates
2. **useCalendarIntegrations** - Calendar service coordination
3. **useTodos** - Todo list state management
4. **useTodoColumns** - Kanban column management
5. **useShoppingLists** - Shopping list operations
6. **useUsers** - User management and permissions
7. **useWeather** - Weather data fetching and caching
8. **useScreensaver** - Photo and display state
9. **useSyncManager** - Real-time SSE connection to backend
10. **useIntegrations** - Integration configuration management
11. **useAlertToast** - Toast notifications (UI state)
12. **useBreakpoint** - Responsive design helpers
13. **useCalendar** - Calendar utility functions
14. **useGlobalLoading** - Global loading state
15. **useSwipe** - Touch gesture detection
16. **useStableDate** - Date utilities
17. **useShoppingIntegrations** - Shopping service coordination
18. **useTodoHandlers** - Todo UI event handlers

**Gap:** No tests for:

- State initialization
- Error handling in data fetching
- Optimistic update rollback
- Real-time sync reliability
- Data consistency during network failures

### Backend (Nitro API Routes)

#### API Route Coverage (96 routes total)

**Calendar Events (11 routes)**

- GET, POST, PUT, DELETE calendar events
- Event export (iCal)
- Get calendars list
- Two-way sync with Google Calendar
- **No tests for:** Date validation, timezone handling, conflict resolution, sync failures, orphaned events

**Chores (11 routes)**

- CRUD operations
- Completion workflow (`claim`, `complete`, `verify`)
- History tracking
- **No tests for:** State transitions, permission validation, points allocation correctness, incomplete workflows

**Rewards (8 routes)**

- CRUD operations
- Redemption workflow (`redeem`, `approve`, `reject`)
- Redemption history
- **No tests for:** Approval logic, point deductions, duplicate redemptions, race conditions

**Shopping Lists & Items (14 routes)**

- List CRUD
- Item CRUD
- Reordering (items and lists)
- Clear completed items
- Mealie/Tandoor integration
- **No tests for:** Reorder index validation, list isolation, integration sync conflicts

**Todo Lists & Columns (12 routes)**

- Column CRUD and reordering
- Todo CRUD and reordering
- Clear completed todos
- **No tests for:** Orphaned todos after column deletion, reorder index conflicts, race conditions

**Users (7 routes)**

- CRUD operations
- Points history
- Reordering
- PIN verification
- **No tests for:** Permission checks, PIN security, concurrent updates

**Integrations (25+ routes)**

- Integration CRUD
- Google Calendar OAuth flow
- Google Photos OAuth flow
- Google Calendar events sync
- Google Photos album/image fetching
- Home Assistant weather
- Immich integration
- iCal import
- Mealie/Tandoor proxy
- **No tests for:** OAuth token handling, token refresh, expired tokens, rate limiting, sync failures

**Household Settings (3 routes)**

- Get/update settings
- PIN verification
- **No tests for:** PIN security, settings validation, concurrent updates

**Sync/SSE (4 routes)**

- Client registration
- Event streaming
- Sync trigger
- Status check
- **No tests for:** Connection handling, message ordering, client cleanup, reconnection logic

**Weather (2 routes)**

- Current weather
- Forecast
- **No tests for:** Cache invalidation, provider failover, error handling

**Screensaver (2 routes)**

- Get photos
- Get settings
- **No tests for:** Photo rotation logic, cache efficiency

---

## Critical User Paths Without Test Coverage

### 1. Calendar Event Lifecycle (CRITICAL)

**User Path:**

1. Create event → 2. Assign users → 3. Sync to Google Calendar → 4. Edit event → 5. Delete event

**Gaps:**

- Date/time validation (UTC conversion, timezones)
- Google Calendar sync conflicts
- Orphaned events on integration disconnection
- Concurrent modifications
- iCal import conflict resolution

### 2. Chore Completion Workflow (CRITICAL)

**User Path:**

1. Child views chore → 2. Clicks "Mark Complete" → 3. Adult verifies → 4. Points awarded

**Gaps:**

- State validation (can't verify before completion)
- Points calculation (multiple points, bonuses)
- Duplicate submissions
- Permission enforcement (children can't verify)
- History tracking accuracy

### 3. Reward Redemption Workflow (CRITICAL)

**User Path:**

1. Child views rewards → 2. Requests redemption → 3. Adult approves/rejects → 4. Points deducted

**Gaps:**

- Insufficient points check
- Concurrent redemptions (race condition)
- Approval authorization
- Point deduction atomicity
- Duplicate approval/rejection

### 4. Shopping List Sync (HIGH)

**User Path:**

1. Add item to list → 2. Sync with Mealie → 3. Modify in Mealie → 4. Refresh to see changes

**Gaps:**

- Bidirectional sync conflicts
- Item ID mapping
- Deleted items handling
- Integration state validation
- Race conditions during sync

### 5. Todo Kanban Workflow (HIGH)

**User Path:**

1. Create column → 2. Add todo to column → 3. Drag todo to new column → 4. Mark complete → 5. Delete column

**Gaps:**

- Reorder index consistency
- Orphaned todos after column deletion
- Drag-and-drop state corruption
- User assignment validation
- Column visibility permissions

### 6. Google OAuth Integration Setup (CRITICAL)

**User Path:**

1. Click "Connect Google" → 2. OAuth popup → 3. Grant permissions → 4. Callback → 5. Token stored

**Gaps:**

- Token encryption/decryption
- Token refresh logic
- Expired token handling
- Scope validation
- State parameter validation (CSRF)
- Redirect URI validation

### 7. Screensaver Auto-Rotation (MEDIUM)

**User Path:**

1. Configure photos source → 2. Select album → 3. Auto-rotate display → 4. Handle network errors

**Gaps:**

- Photo fetch failure handling
- Album permission changes
- Rotation interval correctness
- Image caching behavior
- Concurrent requests

### 8. Household Settings with PIN (CRITICAL)

**User Path:**

1. Adult updates household settings → 2. Child tries to access → 3. PIN dialog appears → 4. PIN validated

**Gaps:**

- PIN strength validation
- PIN rate limiting (brute force)
- PIN clearing on logout
- Concurrent setting updates
- Permission escalation

---

## Test Structure Recommendations

### 1. Unit Tests (Missing - HIGH PRIORITY)

Create `app/__tests__/` directory with:

```
app/__tests__/
├── composables/
│   ├── useCalendarEvents.test.ts      [100+ lines]
│   ├── useTodos.test.ts               [80+ lines]
│   ├── useShoppingLists.test.ts       [80+ lines]
│   ├── useSyncManager.test.ts         [150+ lines]
│   ├── useUsers.test.ts               [60+ lines]
│   └── ...
├── utils/
│   ├── error.test.ts                  [40+ lines]
│   ├── optimistic.test.ts             [80+ lines]
│   └── ...
└── types/
    └── integrations.test.ts           [100+ lines]
```

**Scope:** Test composable logic with Vitest, no DOM/network

### 2. API Route Tests (Missing - CRITICAL)

Create `server/api/__tests__/` directory with:

```
server/api/__tests__/
├── calendar-events/
│   ├── index.post.test.ts             [Validation, timezone)
│   ├── [id].put.test.ts               [Authorization)
│   └── sync.test.ts                   [Conflict resolution)
├── chores/
│   ├── [id]/verify.post.test.ts       (Points allocation)
│   └── history.get.test.ts
├── rewards/
│   ├── [id]/redeem.post.test.ts       (Race condition)
│   └── redemptions/[id]/approve.test.ts
├── todos/
│   ├── reorder.test.ts                (Index validation)
│   └── [id].delete.test.ts            (Cleanup)
├── shopping-lists/
│   ├── [id]/items.post.test.ts        (Integration sync)
│   └── reorder.test.ts
└── integrations/
    ├── google-calendar/oauth/callback.test.ts (Token handling)
    └── [...path].test.ts              (Proxy validation)
```

**Scope:** Test with h3-test-utils or vitest, mock database with Prisma

### 3. E2E Tests (Missing - CRITICAL)

Create `tests/` directory (currently empty) with:

```
tests/
├── auth/
│   ├── pin-verification.spec.ts
│   └── household-setup.spec.ts
├── calendar/
│   ├── event-creation.spec.ts
│   ├── google-sync.spec.ts
│   └── timezone-handling.spec.ts
├── chores/
│   ├── chore-completion-workflow.spec.ts
│   └── points-allocation.spec.ts
├── rewards/
│   ├── redemption-workflow.spec.ts
│   └── point-deduction.spec.ts
├── shopping/
│   ├── list-management.spec.ts
│   ├── mealie-sync.spec.ts
│   └── reordering.spec.ts
├── todos/
│   ├── kanban-workflow.spec.ts
│   └── reordering.spec.ts
├── integrations/
│   ├── google-oauth-setup.spec.ts
│   ├── home-assistant-weather.spec.ts
│   └── immich-photos.spec.ts
└── regression/
    └── regression-settings-features.spec.ts (placeholder exists)
```

**Scope:** Full user workflows with real backend

---

## Test Configuration Improvements Needed

### playwright.config.ts Issues

1. **Web server is commented out** - Can't run tests without manual server start

   ```typescript
   // Should be:
   webServer: {
     command: "npm run build && npm run preview",
     url: "http://localhost:8877",
     reuseExistingServer: !process.env.CI,
     timeout: 120000,
   }
   ```

2. **Only Chromium browser** - Should test Firefox/Safari for family compatibility

   ```typescript
   // Uncomment for multi-browser testing:
   { name: "firefox", use: { ...devices["Desktop Firefox"] } },
   { name: "webkit", use: { ...devices["Desktop Safari"] } },
   ```

3. **No mobile testing** - App is designed for tablets/touch

   ```typescript
   // Add:
   { name: "iPad", use: { ...devices["iPad (gen 7)"] } },
   { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
   ```

4. **Missing global setup/teardown**
   - Database reset between tests
   - User fixture creation
   - Test data isolation

---

## Coverage Gap Analysis by Feature

| Feature               | Pages  | Composables | API Routes | Unit Tests | Integration Tests | E2E Tests |
| --------------------- | ------ | ----------- | ---------- | ---------- | ----------------- | --------- |
| **Calendar**          | 1      | 3           | 11         | ❌         | ❌                | ❌        |
| **Chores**            | 1      | 1           | 11         | ❌         | ❌                | ❌        |
| **Rewards**           | 1      | 1           | 8          | ❌         | ❌                | ❌        |
| **Shopping Lists**    | 1      | 2           | 14         | ❌         | ❌                | ❌        |
| **To-Do Lists**       | 1      | 3           | 12         | ❌         | ❌                | ❌        |
| **Screensaver**       | 1      | 1           | 2          | ❌         | ❌                | ❌        |
| **Meal Planner**      | 1      | 0           | 0          | ❌         | ❌                | ❌        |
| **Settings**          | 1      | 2           | 28         | ❌         | ❌                | ❌        |
| **Users**             | 0      | 1           | 7          | ❌         | ❌                | ❌        |
| **Weather**           | 0      | 1           | 2          | ❌         | ❌                | ❌        |
| **Auth/Integrations** | 0      | 2           | 25+        | ❌         | ❌                | ❌        |
| **Real-time Sync**    | 0      | 1           | 4          | ❌         | ❌                | ❌        |
| **Total**             | **10** | **18**      | **96**     | **0/18**   | **0/96**          | **0**     |

---

## Specific Bugs Likely to Be Caught by Tests

### Timezone-Related Bugs

```typescript
// Example: Calendar event with timezone issues
// UTC stored correctly? Display in user TZ? Google sync?
// TEST: Event at 2pm Chicago should appear at 3pm EST in sync
```

### Race Conditions

```typescript
// Concurrent reward redemptions could double-deduct points
// REORDER: Multiple users dragging simultaneously could corrupt indices
// CALENDAR: Simultaneous edits could overwrite changes
```

### Permission Escalation

```typescript
// Child could access adult-only settings without PIN
// Child could increase own points
// Child could delete other users
```

### State Corruption

```typescript
// Delete column → todos become orphaned
// Integration disconnect → cached data stale
// Network reconnect → duplicate items
```

### OAuth Issues

```typescript
// Token expiration → silent failures
// Refresh token invalid → no recovery
// Scope mismatch → partial sync
```

---

## Quick Start: Implementing Tests

### Step 1: Setup (1 hour)

```bash
# Already installed: @playwright/test
# Add for unit tests:
npm install -D vitest @testing-library/vue jsdom

# Create test structure:
mkdir -p app/__tests__/{composables,utils,types}
mkdir -p server/api/__tests__/{calendar-events,chores,rewards,etc}
mkdir tests
```

### Step 2: Write First Unit Test (1 hour)

```typescript
// app/__tests__/composables/useUsers.test.ts
import { beforeEach, describe, expect, it } from "vitest";

import { useUsers } from "~/composables/useUsers";

describe("useUsers", () => {
  it("should fetch users successfully", async () => {
    // Mock fetch
    // Call useUsers()
    // Assert users loaded
  });

  it("should handle fetch errors", async () => {
    // Mock fetch to fail
    // Call useUsers()
    // Assert error state
  });
});
```

### Step 3: Write First API Test (2 hours)

```typescript
// server/api/__tests__/chores/[id]/verify.post.test.ts
import { describe, expect, it } from "vitest";

import { prismaMock } from "../test-utils";

describe("POST /api/chores/[id]/verify", () => {
  it("should verify chore and award points", async () => {
    // Mock Prisma
    // Call endpoint
    // Assert points awarded
  });

  it("should reject if not verified by adult", async () => {
    // Child tries to verify own chore
    // Assert 403 error
  });
});
```

### Step 4: Write First E2E Test (3 hours)

```typescript
// tests/chores/chore-completion-workflow.spec.ts
import { expect, test } from "@playwright/test";

test("Child completes chore and gets points", async ({ page }) => {
  await page.goto("/chores");
  await page.click("[data-testid=\"chore-item\"]");
  await page.click("[data-testid=\"mark-complete-btn\"]");
  await expect(page.locator("[data-testid=\"success-toast\"]"))
    .toContainText("Chore marked complete");
});
```

---

## Risk Assessment

### Without Tests, These Are Likely:

- **Data corruption:** Concurrent operations race conditions
- **Silent failures:** Network errors mask bad state
- **Privilege escalation:** Missing permission checks
- **Integration failures:** OAuth token errors not caught
- **User frustration:** Unpredictable workflows (rewards don't approve, points don't update)

### Impact on Features:

- **Calendar:** Two-way sync conflicts, orphaned events
- **Chores/Rewards:** Points miscalculation, race conditions
- **Shopping Lists:** Sync failures with external services
- **Real-time Updates:** SSE connection drops, stale state

---

## Recommendations Priority

### 🔴 CRITICAL (This Sprint)

1. Create E2E test for chore completion workflow (most complex state change)
2. Create E2E test for reward redemption workflow
3. Create unit tests for timezone/date handling
4. Enable web server in Playwright config
5. Create test data fixtures

### 🟡 HIGH (Next Sprint)

1. Unit tests for all composables (18 files)
2. API route tests for critical paths (25+ routes)
3. Integration tests for OAuth flows
4. Add multi-browser testing (Firefox, Safari)
5. Add mobile viewport testing

### 🟢 MEDIUM (Future)

1. Performance tests (reordering with 1000 items)
2. Load tests (multiple concurrent users)
3. Accessibility tests (WCAG compliance)
4. Visual regression tests (design consistency)

---

## Summary

**SkyLite-UX is production-ready in features but untested in correctness.**

With 96 API routes, 18 composables, and 50 Vue components handling complex state (calendar sync, points, redemptions, integrations), **zero test coverage is unsustainable.**

**Estimated effort to full coverage:**

- Unit tests: 40-50 hours
- API tests: 30-40 hours
- E2E tests: 20-30 hours
- **Total: 90-120 hours (~3-4 weeks with 2 developers)**

**Next step:** Start with E2E tests for critical workflows (chores, rewards, calendar) - these catch 80% of bugs in 20% of effort.
