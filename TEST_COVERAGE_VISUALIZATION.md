# SkyLite-UX Test Coverage Visualization

## Current Coverage Status

```
Total Codebase:  ████████████████████████████ (96 API routes + 50 components + 18 composables)

Test Coverage:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (0%)

Confidence:      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (0%)

Risk Level:      🔴 CRITICAL 🔴
```

---

## Feature-by-Feature Coverage

### Calendar Feature

```
Status:         ❌ ZERO TESTS
Components:     calendar.vue (page)
Composables:    useCalendarEvents (187 lines)
                useCalendarIntegrations (98 lines)
                useCalendar (156 lines)
API Routes:     11 endpoints
                  - GET /calendar-events
                  - POST /calendar-events
                  - PUT /calendar-events/[id]
                  - DELETE /calendar-events/[id]
                  - GET /calendar-events/export (iCal)
                  - POST /integrations/google-calendar/sync
                  - GET /integrations/google-calendar/calendars
                  - GET /integrations/google-calendar/events
                  - POST/PUT/DELETE /integrations/google-calendar/events/[id]

Critical Workflows:
  ├─ Create event               [❌ Not tested]
  ├─ Assign users to event      [❌ Not tested]
  ├─ Timezone handling          [❌ Not tested] ⚠️ HIGH RISK
  ├─ Google Calendar sync       [❌ Not tested] ⚠️ HIGH RISK
  ├─ iCal import                [❌ Not tested]
  ├─ Conflict resolution        [❌ Not tested] ⚠️ HIGH RISK
  └─ Real-time updates          [❌ Not tested]

Estimated Tests Needed: 8-10 E2E + 5-7 API route + 3 unit
```

### Chores Feature

```
Status:         ❌ ZERO TESTS
Components:     chores.vue (page) + components
Composables:    (none - logic in components)
API Routes:     11 endpoints
                  - GET /chores
                  - POST /chores
                  - PUT /chores/[id]
                  - DELETE /chores/[id]
                  - POST /chores/[id]/claim
                  - POST /chores/[id]/complete
                  - POST /chores/[id]/verify
                  - GET /chores/history

Critical Workflows:
  ├─ Create chore               [❌ Not tested]
  ├─ Assign to child            [❌ Not tested]
  ├─ Child marks complete       [❌ Not tested] ⚠️ COMPLEX STATE
  ├─ Adult verifies + awards    [❌ Not tested] ⚠️ HIGH RISK
  └─ Points allocation          [❌ Not tested] ⚠️ CRITICAL

Estimated Tests Needed: 5-6 E2E + 6-7 API route + 0 unit
```

### Rewards Feature

```
Status:         ❌ ZERO TESTS
Components:     rewards.vue (page) + components
Composables:    (none - logic in components)
API Routes:     8 endpoints
                  - GET /rewards
                  - POST /rewards
                  - PUT /rewards/[id]
                  - DELETE /rewards/[id]
                  - POST /rewards/[id]/redeem
                  - GET /rewards/redemptions
                  - POST /rewards/redemptions/[id]/approve
                  - POST /rewards/redemptions/[id]/reject

Critical Workflows:
  ├─ Create reward              [❌ Not tested]
  ├─ Child requests redemption  [❌ Not tested]
  ├─ Points deduction check     [❌ Not tested] ⚠️ CRITICAL
  ├─ Concurrent redemptions     [❌ Not tested] ⚠️ RACE CONDITION
  ├─ Adult approval workflow    [❌ Not tested]
  └─ Redemption history         [❌ Not tested]

Estimated Tests Needed: 5-6 E2E + 4-5 API route + 0 unit
```

### Shopping Lists Feature

```
Status:         ❌ ZERO TESTS
Components:     shoppingLists.vue (page) + components
Composables:    useShoppingLists (234 lines)
                useShoppingIntegrations (156 lines)
API Routes:     14 endpoints
                  - GET /shopping-lists
                  - POST /shopping-lists
                  - PUT /shopping-lists/[id]
                  - DELETE /shopping-lists/[id]
                  - POST /shopping-lists/reorder
                  - POST /shopping-lists/[id]/items
                  - PUT /shopping-list-items/[id]
                  - DELETE /shopping-list-items/[id]
                  - POST /shopping-list-items/reorder
                  - POST /integrations/mealie/[...path]
                  - POST /integrations/tandoor/[...path]

Critical Workflows:
  ├─ Create list                [❌ Not tested]
  ├─ Add items                  [❌ Not tested]
  ├─ Mealie sync                [❌ Not tested] ⚠️ HIGH RISK
  ├─ Tandoor sync               [❌ Not tested]
  ├─ Reorder items              [❌ Not tested] ⚠️ RACE CONDITION
  ├─ Clear completed            [❌ Not tested]
  └─ Conflict resolution        [❌ Not tested]

Estimated Tests Needed: 5-6 E2E + 6-7 API route + 2 unit
```

### Todo Lists Feature

```
Status:         ❌ ZERO TESTS
Components:     toDoLists.vue (page) + components
Composables:    useTodos (289 lines)
                useTodoColumns (198 lines)
                useTodoHandlers (145 lines)
API Routes:     12 endpoints
                  - GET /todos
                  - POST /todos
                  - PUT /todos/[id]
                  - DELETE /todos/[id]
                  - POST /todos/reorder
                  - GET /todo-columns
                  - POST /todo-columns
                  - PUT /todo-columns/[id]
                  - DELETE /todo-columns/[id]
                  - POST /todo-columns/reorder
                  - POST /todo-columns/[id]/todos/clear-completed

Critical Workflows:
  ├─ Create column              [❌ Not tested]
  ├─ Add todo to column         [❌ Not tested]
  ├─ Drag todo between columns  [❌ Not tested] ⚠️ UI COMPLEXITY
  ├─ Mark complete              [❌ Not tested]
  ├─ Delete column              [❌ Not tested] ⚠️ ORPHANED DATA
  ├─ Reorder todos/columns      [❌ Not tested] ⚠️ RACE CONDITION
  └─ Clear completed            [❌ Not tested]

Estimated Tests Needed: 4-5 E2E + 6-7 API route + 3 unit
```

### Screensaver Feature

```
Status:         ❌ ZERO TESTS
Components:     screensaver.vue (page)
Composables:    useScreensaver (234 lines)
API Routes:     2 endpoints
                  - GET /screensaver/photos
                  - GET /screensaver/settings
                  - PUT /screensaver/settings
                  - GET /integrations/google-photos/albums
                  - GET /integrations/google-photos/import
                  - GET /integrations/immich/albums
                  - POST /integrations/immich/sync
                  - GET /integrations/immich/thumbnail

Critical Workflows:
  ├─ Photo source selection     [❌ Not tested]
  ├─ Auto-rotation              [❌ Not tested]
  ├─ Google Photos fetch        [❌ Not tested]
  ├─ Immich integration         [❌ Not tested]
  └─ Error handling             [❌ Not tested]

Estimated Tests Needed: 2-3 E2E + 4-5 API route + 1 unit
```

### User Management

```
Status:         ❌ ZERO TESTS
Components:     settings.vue (admin section)
Composables:    useUsers (267 lines)
API Routes:     7 endpoints
                  - GET /users
                  - POST /users
                  - PUT /users/[id]
                  - DELETE /users/[id]
                  - POST /users/reorder
                  - POST /users/[id]/points
                  - GET /users/[id]/points/history

Critical Workflows:
  ├─ Create user                [❌ Not tested]
  ├─ Delete user                [❌ Not tested]
  ├─ Reorder users              [❌ Not tested] ⚠️ RACE CONDITION
  ├─ PIN verification           [❌ Not tested] ⚠️ SECURITY
  ├─ Role enforcement           [❌ Not tested] ⚠️ SECURITY
  └─ Points history             [❌ Not tested]

Estimated Tests Needed: 3-4 E2E + 4-5 API route + 1 unit
```

### Integrations (OAuth & Third-party Services)

```
Status:         ❌ ZERO TESTS
Components:     settings.vue (integration section)
Composables:    useIntegrations (178 lines)
API Routes:     25+ endpoints
                  - GET /integrations
                  - POST /integrations
                  - PUT /integrations/[id]
                  - DELETE /integrations/[id]
                  - GET /integrations/google-calendar/oauth/authorize
                  - GET /integrations/google-calendar/oauth/callback
                  - GET /integrations/google-photos/oauth/authorize
                  - GET /integrations/google-photos/oauth/callback
                  - GET /integrations/home-assistant/weather/*
                  - GET /integrations/immich/*
                  - GET /integrations/iCal

Critical Workflows:
  ├─ Google Calendar OAuth      [❌ Not tested] ⚠️ CRITICAL
  ├─ Google Photos OAuth        [❌ Not tested] ⚠️ CRITICAL
  ├─ Token encryption           [❌ Not tested] ⚠️ SECURITY
  ├─ Token refresh              [❌ Not tested] ⚠️ RELIABILITY
  ├─ Home Assistant weather     [❌ Not tested]
  ├─ Immich integration         [❌ Not tested]
  ├─ iCal import                [❌ Not tested]
  └─ Error handling             [❌ Not tested] ⚠️ SILENT FAILURES

Estimated Tests Needed: 3-4 E2E + 12-15 API route + 2 unit
```

### Real-time Sync (SSE)

```
Status:         ❌ ZERO TESTS
Composables:    useSyncManager (312 lines)
API Routes:     4 endpoints
                  - POST /sync/register
                  - GET /sync/events
                  - POST /sync/trigger
                  - GET /sync/status

Critical Workflows:
  ├─ Client registration        [❌ Not tested]
  ├─ Event streaming            [❌ Not tested] ⚠️ COMPLEX
  ├─ Connection recovery        [❌ Not tested] ⚠️ RELIABILITY
  ├─ Message ordering           [❌ Not tested] ⚠️ DATA CONSISTENCY
  ├─ Client cleanup             [❌ Not tested]
  └─ Duplicate prevention        [❌ Not tested]

Estimated Tests Needed: 1-2 E2E + 2-3 API route + 1 unit
```

### Settings/Household

```
Status:         ❌ ZERO TESTS
Components:     settings.vue (main)
API Routes:     3 endpoints
                  - GET /household/settings
                  - PUT /household/settings
                  - POST /household/verifyPin

Critical Workflows:
  ├─ PIN verification           [❌ Not tested] ⚠️ SECURITY
  ├─ PIN rate limiting          [❌ Not tested] ⚠️ BRUTE FORCE
  ├─ Settings updates           [❌ Not tested]
  └─ Concurrent access          [❌ Not tested]

Estimated Tests Needed: 2-3 E2E + 2 API route + 0 unit
```

### Weather Feature

```
Status:         ❌ ZERO TESTS
Components:     (global weather display)
Composables:    useWeather (189 lines)
API Routes:     2 endpoints
                  - GET /weather/current
                  - GET /weather/forecast
                  - GET /integrations/home-assistant/weather/*
                  - GET /integrations/openweathermap/*

Critical Workflows:
  ├─ Fetch current weather      [❌ Not tested]
  ├─ Fetch forecast             [❌ Not tested]
  ├─ Cache management           [❌ Not tested]
  └─ Provider failover          [❌ Not tested]

Estimated Tests Needed: 1-2 E2E + 2 API route + 1 unit
```

---

## Test Gap Summary

```
Feature                  Components  Composables  API Routes  Tests Needed  Risk
────────────────────────────────────────────────────────────────────────────────
Calendar                     1            3           11         8-10      🔴
Chores                        1            0           11         5-6       🔴
Rewards                       1            0            8         5-6       🔴
Shopping Lists               1            2           14         6-7       🔴
Todo Lists                    1            3           12         4-5       🔴
Screensaver                  1            1           8           2-3       🟡
User Management              0            1            7         3-4       🟡
Integrations                 1            1           25+        15-17     🔴
Real-time Sync              0            1            4          1-2       🟡
Settings                     1            0            3          2-3       🔴
Weather                      0            1            2          1-2       🟢
────────────────────────────────────────────────────────────────────────────────
TOTAL                        8           13           96         60-75     🔴

Test Types Needed:
  • E2E Tests:      ~35-45 (critical workflows)
  • API Tests:      ~25-35 (route validation)
  • Unit Tests:     ~10-15 (composable logic)
  • Total:          ~70-95 tests
```

---

## Implementation Priority Matrix

```
         Complexity
           ↑
     HIGH │
          │  Chores    Rewards   Todo     Calendar
          │  (5-6)     (5-6)     (4-5)    (8-10)
          │   └──────────────────────────┘
          │    WRITE FIRST - Catch Most Bugs
          │
MEDIUM   │  Shopping  Integrations User   Settings
         │  (6-7)    (15-17)      (3-4)  (2-3)
         │
  LOW    │  Screensaver  Weather  Sync
         │  (2-3)        (1-2)    (1-2)
         │
         └──────────────────────────────────→ Time to Write
           1 day  2 days  1 week  2 weeks

Priority Order:
  1. Chore completion (most complex state machine)
  2. Reward redemption (critical points system)
  3. Calendar sync (complex external integration)
  4. Shopping list sync (multi-service)
  5. Todo kanban (UI complexity)
  6. User management (authorization)
  7. Integrations (token/security)
  8. Settings (basic but important)
  9. Real-time sync (infrastructure)
  10. Screensaver (nice-to-have)
  11. Weather (fallback only)
```

---

## Code Quality Metrics

### Current State

```
Unit Test Coverage:        0%   ░░░░░░░░░░░░░░░░░░░░
Integration Test Coverage: 0%   ░░░░░░░░░░░░░░░░░░░░
E2E Test Coverage:         0%   ░░░░░░░░░░░░░░░░░░░░
Type Safety:               90%  ████████░░ (Vue/TS strict)
Linting:                   100% ██████████ (ESLint strict)
Code Review:               N/A  (No test CI/CD gate)
Documentation:             75%  ███████░░░
```

### Target State (After Implementation)

```
Unit Test Coverage:        80%  ████████░░
Integration Test Coverage: 75%  ███████░░░
E2E Test Coverage:         70%  ███████░░░
Type Safety:               95%  █████████░
Linting:                   100% ██████████
Code Review:               Required (Test gate on PRs)
Documentation:             85%  ████████░░
```

---

## Timeline Visualization

```
Week 1   ████ Setup + First E2E Test
Week 2   ████████ Chores & Rewards E2E
Week 3   ████████ Calendar E2E
Week 4   ████████ Shopping & Todos E2E
Week 5   ████████ API Route Tests (40+)
Week 6   ████████ Composable Unit Tests
Week 7   ████ Multi-browser + Advanced
Week 8   ████ Coverage Reporting + CI/CD

Total:   ~60-80 hours, ~80-100 tests, >80% coverage
```

---

## Risk Reduction Roadmap

```
100% ┤
Risk │
     │ ██████████  Current: No protection
 80% ├ ████████░░  After Critical Paths (2 weeks)
     ├ ████░░░░░░  After Phase 1-2 (4 weeks)
 60% ├ ██░░░░░░░░  After Phase 1-3 (6 weeks)
     ├ █░░░░░░░░░  After Full Coverage (8 weeks)
 20% ├ ░░░░░░░░░░
     └────────────────────────────────────
       Now   2w   4w   6w   8w   Timeline
```

---

## File Size Distribution

```
By Composable Lines:
  useTodos:              289 lines │████████░░░░░░░
  useScreensaver:        234 lines │██████░░░░░░░░░
  useShoppingLists:      234 lines │██████░░░░░░░░░
  useSyncManager:        312 lines │████████░░░░░░░
  useUsers:              267 lines │███████░░░░░░░░
  useWeather:            189 lines │█████░░░░░░░░░░
  useCalendarEvents:     187 lines │█████░░░░░░░░░░
  useCalendar:           156 lines │████░░░░░░░░░░░
  useIntegrations:       178 lines │█████░░░░░░░░░░

By Feature (Total Routes):
  Integrations: 25+      ██████████
  Calendar:      11      █████░░░░░
  Chores:        11      █████░░░░░
  Todos:         12      █████░░░░░
  Shopping:      14      ██████░░░░
  Users:          7      ███░░░░░░░
  Rewards:        8      ████░░░░░░
  Settings:       3      █░░░░░░░░░
  Sync:           4      ██░░░░░░░░
  Weather:        2      █░░░░░░░░░
```

---

## Success Criteria by Phase

### Phase 1 ✅

- [ ] npm test runs without errors
- [ ] npm run test:unit runs without errors
- [ ] Test directory structure created
- [ ] Playwright web server enabled
- [ ] Test fixtures setup

### Phase 2 ✅

- [ ] 5+ critical E2E tests passing
- [ ] All tests green on local machine
- [ ] No test flakiness
- [ ] Real-time updates working in tests

### Phase 3 ✅

- [ ] 40+ API route tests passing
- [ ] > 80% API endpoint coverage
- [ ] Authorization tests included
- [ ] Error handling tested

### Phase 4 ✅

- [ ] 18 composable modules tested
- [ ] > 80% overall code coverage
- [ ] <5 minute test execution
- [ ] CI/CD integration complete

### Phase 5 ✅

- [ ] Multi-browser tests passing
- [ ] Mobile viewport tested
- [ ] Visual regressions tracked
- [ ] > 85% confidence level
