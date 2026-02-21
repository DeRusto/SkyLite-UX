# Architecture Review Findings

**Date:** 2026-02-21
**Reviewer:** Specialized Architecture Agent
**Files Analyzed:** 40+ component, composable, and integration files
**Total Issues:** 15 architectural anti-patterns identified

---

## Summary

The SkyLite-UX architecture has solid foundations but suffers from coupling issues, component bloat, and inconsistent patterns that will create maintenance challenges as the project grows. Most issues are refactoring-level (not breaking), but the plugin coupling is a critical design smell.

---

## Critical Issues (1)

### 1. Direct Plugin Import Coupling

**Severity:** CRITICAL - Design Anti-pattern
**Category:** Architecture

**Problem:**
Composables and components directly import `integrationServices` from plugins instead of using composed APIs. This violates separation of concerns and makes testing difficult.

**Locations:**
- `app/composables/useIntegrations.ts` (line 5): Imports from `~/plugins/02.appInit`
- `app/pages/settings.vue` (line 1): Imports from `~/plugins/02.appInit`

**Why This Matters:**
- **Testing:** Can't mock plugin state in unit tests
- **Initialization:** Plugins are runtime setup code, not APIs
- **Circular Coupling:** Plugin depends on composable setup, composable depends on plugin
- **Future Migrations:** Hard to switch from plugins to other initialization methods

**Recommended Fix:**

Create a composable layer instead:

```typescript
// app/composables/useIntegrationServices.ts
export function useIntegrationServices() {
  // Lazy-load from plugin or provide pattern
  const services = useNuxtApp().$integrationServices
  return { services }
}
```

Then update imports:
```typescript
// Instead of: import { integrationServices } from "~/plugins/02.appInit"
// Use:
const { services: integrationServices } = useIntegrationServices()
```

**Fix Complexity:** Medium (1-2 hours)
**Files to Change:** 2 critical + 3-5 downstream

---

## High Priority Issues (5)

### 2. Oversized Components (Component Size Violations)

**Severity:** HIGH - Maintainability
**Category:** Code Organization

**Problem:**
Five Vue components exceed the 300-line limit significantly, causing:
- High cognitive load
- Difficult unit testing
- Mixed responsibilities
- Harder to review changes

**Component Violations:**

| Component | Lines | Multiple of Limit | Issues |
|-----------|-------|------------------|--------|
| `calendarEventDialog.vue` | 1,533 | 5.1x | Recurrence logic, event mapping, UI in one file |
| `shoppingListsContent.vue` | 1,063 | 3.5x | Native + integration lists, sorting, filtering |
| `settingsScreensaver.vue` | 959 | 3.2x | Photo service, settings management, UI |
| `settingsIntegrationDialog.vue` | 677 | 2.3x | Form validation, async operations, dialogs |
| `todoListsContent.vue` | 606 | 2x | Todo management, UI rendering |

**Recommended Splits:**

**calendarEventDialog.vue → 4 components:**
- `calendarEventDialog.vue` (300 lines max) - Main form
- `calendarRecurrenceConfig.vue` - Recurrence UI
- `calendarEventTimeSelector.vue` - Date/time picker
- `calendarEventUserSelector.vue` - User selection

**shoppingListsContent.vue → 3 components:**
- `shoppingListsContent.vue` (300 lines) - Main container
- `shoppingListsFiltered.vue` - Native list filtering
- `shoppingListsIntegration.vue` - Integration list display

**Fix Complexity:** High (4-6 hours)
**Testing Impact:** Will unlock unit testing for complex features

---

### 3. Type Casting Anti-Pattern in Integration Services

**Severity:** HIGH - Type Safety
**Category:** TypeScript Best Practices

**Problem:**
Integration services use unsafe `as unknown as { ... }` casts that bypass TypeScript type checking. Method existence isn't verified at compile time.

**Locations:**

```typescript
// ❌ BAD - useShoppingIntegrations.ts lines 99, 132, 152, 190
const service = shoppingIntegrations.value[integrationType] as unknown as {
  addItemToList?: (list: string, item: any) => Promise<void>
}

// ✅ GOOD - useCalendarIntegrations.ts line 50
if (isCalendarService(service)) {
  service.fetchEvents()
}
```

**Why This Matters:**
- Type casts hide compile-time errors
- Methods may be undefined at runtime
- Inconsistent with `calendarIntegrations` which uses proper type guards

**Recommended Fix:**

Define proper union types:

```typescript
type IntegrationService =
  | CalendarIntegrationService
  | ShoppingIntegrationService
  | WeatherIntegrationService

// Type guard for shopping operations
function isShoppingIntegration(
  service: IntegrationService
): service is ShoppingIntegrationService {
  return (service as any).addItemToList !== undefined
}

// Usage
if (isShoppingIntegration(service)) {
  await service.addItemToList(list, item)
}
```

**Fix Complexity:** Medium (2-3 hours)
**Files to Change:** `useShoppingIntegrations.ts`, `useCalendarIntegrations.ts`

---

### 4. Mixed HTTP Client Usage (Consistency)

**Severity:** HIGH - Consistency
**Category:** Architectural Pattern

**Problem:**
Inconsistent use of `fetch()` vs `$fetch()` across composables creates maintenance burden and inconsistent error handling.

**Locations:**
- `useShoppingLists.ts` (line 81): `fetch()`
- `useCalendarEvents.ts` (line 33): `$fetch()`
- `useTodos.ts` (line 81): `fetch()`

**Why This Matters:**
- `$fetch` has Nuxt SSR support, `fetch` doesn't
- Error handling differs between implementations
- Global request interceptors don't work consistently
- Debugging requires understanding both patterns

**Recommended Fix:**
Standardize on `$fetch` everywhere:

```typescript
// ❌ Before
const response = await fetch('/api/todos', { method: 'GET' })
const data = await response.json()

// ✅ After
const data = await $fetch('/api/todos', { method: 'GET' })
```

**Fix Complexity:** Low (1 hour)
**Files to Change:** 3 composables

---

### 5. Plugin Initialization Error Isolation

**Severity:** HIGH - Resilience
**Category:** Error Handling

**Problem:**
Plugin initialization uses `Promise.all()` which causes cascading failures: if one integration fails, all others fail to initialize.

**Location:** `app/plugins/02.appInit.ts` (lines 58-198)

```typescript
// ❌ BAD - If one fails, all fail
const results = await Promise.all([
  initializeGoogleCalendar(),
  initializeWeather(),
  initializeShopping(),
  initializePhotos()
])
```

**Why This Matters:**
- Single integration failure crashes app startup
- No graceful degradation
- Hard to debug which service failed
- User can't use unaffected features

**Recommended Fix:**

```typescript
// ✅ GOOD - All initialize independently
const results = await Promise.allSettled([
  initializeGoogleCalendar(),
  initializeWeather(),
  initializeShopping(),
  initializePhotos()
])

// Check results
results.forEach((result, index) => {
  if (result.status === 'rejected') {
    consola.error(`Service ${index} failed:`, result.reason)
  }
})
```

**Fix Complexity:** Low (30 minutes)
**Impact:** Significantly improves reliability

---

### 6. Inconsistent API Route Error Handling

**Severity:** HIGH - Developer Experience
**Category:** API Design

**Problem:**
Different API routes use different validation and error handling patterns, making the API unpredictable.

**Comparison:**

```typescript
// calendar-events/index.post.ts - GOOD
if (!title || typeof title !== 'string') {
  throw createError({
    statusCode: 400,
    message: 'Title is required and must be a string'
  })
}

// shopping-lists/index.post.ts - INCONSISTENT
if (!name) return { error: 'Missing name' }

// todos/index.post.ts - NO VALIDATION
// Just processes the request
```

**Why This Matters:**
- Inconsistent client error handling
- Some endpoints fail silently
- Different error response structures
- No centralized validation

**Recommended Fix:**

Create shared API middleware:

```typescript
// server/middleware/validateRequest.ts
export function validateRequest(schema: ZodSchema) {
  return defineEventHandler(async (event) => {
    const body = await readBody(event)
    const result = schema.safeParse(body)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: 'Validation failed',
        data: result.error.format()
      })
    }

    // Continue with validated body
    event.context.validatedBody = result.data
  })
}

// Usage in route handler:
export default [validateRequest(todoSchema), defineEventHandler(...)]
```

**Fix Complexity:** Medium (3-4 hours)
**Files to Change:** All API routes

---

## Medium Priority Issues (8)

### 7. Composable Over-Composition and Deep Nesting

**Severity:** MEDIUM - Maintainability
**Category:** State Management

**Files:**
- `useShoppingIntegrations.ts` - Calls 2 composables
- `useCalendarIntegrations.ts` - Calls 4 composables
- `shoppingListsContent.vue` - Calls 2 data composables

**Problem:**
Deep nesting of composable dependencies makes data flow hard to trace and creates potential for circular updates.

**Fix:** Flatten by consolidating:
- Create `useShoppingData()` that manages both native and integration lists
- Create `useCalendarData()` that manages events and integrations
- Update components to use single data source

**Fix Complexity:** Medium (3-4 hours)

---

### 8. Loose Type System for Integration Settings

**Severity:** MEDIUM - Type Safety
**Category:** TypeScript

**Location:** `app/integrations/integrationConfig.ts` (lines 355-370)

**Problem:**
Settings cast to wrong types; no compile-time validation of settings shape.

**Fix:**
```typescript
type IntegrationSettingsMap = {
  'iCal': ICalSettings
  'mealie': MealieSettings
  'google-calendar': GoogleCalendarSettings
  // ...
}

// Validates at compile time
const config: Record<string, IntegrationSettingsMap> = { ... }
```

**Fix Complexity:** Low (1-2 hours)

---

### 9. Duplicate Reordering Logic

**Severity:** MEDIUM - DRY Principle
**Category:** Code Duplication

**Files:**
- `useShoppingLists.ts`: `reorderShoppingList()` + `reorderItem()`
- `useTodos.ts`: `reorderTodo()`
- ~50 lines duplicated 3+ times

**Problem:**
Same reordering logic in multiple places makes maintenance harder.

**Fix:**
Extract to `useReordering(items, onChange)` composable.

**Fix Complexity:** Low (1.5 hours)

---

### 10. Global Mutable State (integrationServices Map)

**Severity:** MEDIUM - Reactivity
**Category:** State Management

**Problem:**
`integrationServices` is a plain Map, not Vue-reactive. Mutations don't trigger component updates.

**Fix:**
```typescript
// Instead of: export const integrationServices = new Map()
// Use:
export const integrationServices = ref<Map<string, any>>(new Map())
```

**Fix Complexity:** Low (30 minutes)

---

### 11-15. Minor Issues

- **Naming Inconsistency**: Cache key generation in multiple places (Low - 30 min)
- **Untyped Payload Access**: Direct `nuxtApp.payload.data` bypasses validation (Low - 1 hour)
- **Missing Capability Validation**: Scattered checks for integration capabilities (Low - 1 hour)
- **API Data Broadcast**: Some CRUD routes don't broadcast SSE updates (Medium - 1 hour)
- **Dialog Component Testing**: No shared test utilities (Medium - 4+ hours)

---

## Refactoring Roadmap

### Phase 1: Foundations (Critical)
- [ ] Replace plugin imports with composables (2 hours)
- [ ] Fix type casting in integrations (2 hours)
- **Total:** 4 hours, unblocks everything else

### Phase 2: Quality (High)
- [ ] Standardize HTTP clients to `$fetch` (1 hour)
- [ ] Fix plugin error isolation (30 min)
- [ ] Add API validation middleware (3 hours)
- [ ] Extract oversized components (6 hours)
- **Total:** 10.5 hours

### Phase 3: Architecture (Medium)
- [ ] Flatten composable dependencies (4 hours)
- [ ] Fix type system for integrations (2 hours)
- [ ] Consolidate reordering logic (1.5 hours)
- [ ] Make integrationServices reactive (30 min)
- **Total:** 8 hours

### Phase 4: Polish (Low)
- [ ] Centralize cache key generation (1 hour)
- [ ] Type payload accessors (1 hour)
- [ ] Add capability validation composable (1 hour)
- [ ] Fix data broadcast in CRUD (1 hour)
- **Total:** 4 hours

---

## Architecture Score

**Current State:** 6.5/10
- ✅ Good: Composables pattern, API routes structure, integration plugin system
- ⚠️ Needs Work: Coupling, component sizes, type safety, consistency
- ❌ Critical: Plugin imports, error isolation

**After Fixes:** 8.5/10
- Cleaner separation of concerns
- Better testability
- Consistent patterns
- Improved resilience

---

## Related Reports

- See `review-typescript.md` for type system issues
- See `review-security.md` for API validation context
- See `review-eslint.md` for code organization issues

