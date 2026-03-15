# Test Implementation Checklist for SkyLite-UX

## Quick Status

- **Test Status:** ❌ ZERO TESTS (0/96 API routes, 0/18 composables, 0 E2E tests)
- **Framework:** ✅ Playwright configured, but no tests written
- **Critical Risk:** 🔴 HIGH - Production app with no test coverage

---

## Phase 1: Setup (Complete in 1 day)

### Prepare Environment

- [ ] Install test libraries: `npm install -D vitest @testing-library/vue jsdom`
- [ ] Create directory structure:
  ```bash
  mkdir -p app/__tests__/{composables,utils,types}
  mkdir -p server/api/__tests__/{calendar-events,chores,rewards,todos,shopping-lists,users,integrations}
  mkdir -p tests/{auth,calendar,chores,rewards,shopping,todos,integrations,regression}
  ```
- [ ] Create `tests/global-setup.ts` (from TEST_EXAMPLES.md)
- [ ] Update `playwright.config.ts` (from TEST_EXAMPLES.md)
- [ ] Create `server/api/__tests__/test-utils.ts` (from TEST_EXAMPLES.md)

### Configure Testing Tools

- [ ] Update package.json with test scripts (see TEST_EXAMPLES.md)
- [ ] Create `.env.test` with test database URL
- [ ] Setup test database (separate from development)
- [ ] Verify `npm run type-check` passes
- [ ] Verify `npm run lint` passes

---

## Phase 2: Critical User Path Tests (Complete in 1-2 weeks)

### Priority 1: Chore Completion Workflow

**Impact:** Highest - Core family feature, complex state transitions

- [ ] Copy E2E test from TEST_EXAMPLES.md → `tests/chores/chore-completion-workflow.spec.ts`
- [ ] Update test IDs in Vue components if needed:
  - [ ] `[data-testid="create-chore-btn"]`
  - [ ] `[data-testid="chore-item"]`
  - [ ] `[data-testid="mark-complete-btn"]`
  - [ ] `[data-testid="verify-chore-btn"]`
- [ ] Run test: `npm run test -- tests/chores/chore-completion-workflow.spec.ts`
- [ ] Fix failing tests until green

### Priority 2: Reward Redemption Workflow

**Impact:** High - Points system, requires authorization

- [ ] Copy race condition test from TEST_EXAMPLES.md → `tests/rewards/concurrent-redemption.spec.ts`
- [ ] Update test IDs in reward components
- [ ] Add test for insufficient points: `tests/rewards/insufficient-points.spec.ts`
- [ ] Add test for approval workflow: `tests/rewards/approval-workflow.spec.ts`
- [ ] Run: `npm run test -- tests/rewards/`
- [ ] Fix failing tests

### Priority 3: Calendar Event Lifecycle

**Impact:** High - Complex sync, timezone handling

- [ ] Create `tests/calendar/event-creation.spec.ts`
  - [ ] Create event with time validation
  - [ ] Assign users to event
  - [ ] Verify in UI and database
- [ ] Create `tests/calendar/timezone-handling.spec.ts`
  - [ ] Create event in user's timezone
  - [ ] Verify UTC storage
  - [ ] Verify display in different timezones
- [ ] Create `tests/calendar/google-sync.spec.ts`
  - [ ] Sync event to Google Calendar
  - [ ] Handle sync conflicts
  - [ ] Handle disconnection
- [ ] Run: `npm run test -- tests/calendar/`

### Priority 4: Shopping List Sync

**Impact:** Medium-High - Integration testing

- [ ] Create `tests/shopping/list-management.spec.ts`
- [ ] Create `tests/shopping/mealie-sync.spec.ts`
- [ ] Create `tests/shopping/reordering.spec.ts` (race condition)
- [ ] Run: `npm run test -- tests/shopping/`

### Priority 5: Todo Kanban Workflow

**Impact:** Medium-High - Complex UI, reordering

- [ ] Create `tests/todos/kanban-workflow.spec.ts`
  - [ ] Create column
  - [ ] Add todo to column
  - [ ] Drag todo to new column
  - [ ] Mark complete
  - [ ] Delete column
- [ ] Create `tests/todos/reordering.spec.ts` (concurrent drag-drop)
- [ ] Run: `npm run test -- tests/todos/`

---

## Phase 3: API Route Tests (Complete in 2-3 weeks)

### Calendar Events API (11 routes)

- [ ] `server/api/__tests__/calendar-events/index.post.test.ts`
  - [ ] Validate title required
  - [ ] Validate start/end times
  - [ ] Validate end > start
  - [ ] Verify broadcast sent
- [ ] `server/api/__tests__/calendar-events/[id].put.test.ts`
- [ ] `server/api/__tests__/calendar-events/[id].delete.test.ts`

### Chores API (11 routes)

- [ ] Copy test from TEST_EXAMPLES.md → `server/api/__tests__/chores/[id]/verify.post.test.ts`
- [ ] `server/api/__tests__/chores/index.post.test.ts` (create)
- [ ] `server/api/__tests__/chores/[id]/claim.post.test.ts`
- [ ] `server/api/__tests__/chores/[id]/complete.post.test.ts`
- [ ] `server/api/__tests__/chores/history.get.test.ts`

### Rewards API (8 routes)

- [ ] `server/api/__tests__/rewards/[id]/redeem.post.test.ts`
  - [ ] Validate sufficient points
  - [ ] Prevent double-redemption
  - [ ] Deduct points atomically
- [ ] `server/api/__tests__/rewards/redemptions/[id]/approve.post.test.ts`
- [ ] `server/api/__tests__/rewards/redemptions/[id]/reject.post.test.ts`

### Todos API (12 routes)

- [ ] `server/api/__tests__/todos/reorder.post.test.ts`
  - [ ] Validate index uniqueness
  - [ ] Prevent gaps in reorder
- [ ] `server/api/__tests__/todo-columns/[id]/delete.test.ts`
  - [ ] Handle orphaned todos

### Shopping Lists API (14 routes)

- [ ] `server/api/__tests__/shopping-lists/[id]/items.post.test.ts`
- [ ] `server/api/__tests__/shopping-list-items/reorder.post.test.ts`

### Users API (7 routes)

- [ ] `server/api/__tests__/users/index.post.test.ts` (create)
- [ ] `server/api/__tests__/users/verifyPin.post.test.ts` (PIN validation)
- [ ] `server/api/__tests__/users/reorder.post.test.ts`

### Integrations API (25+ routes)

- [ ] `server/api/__tests__/integrations/google-calendar/oauth/callback.test.ts`
  - [ ] Token encryption/decryption
  - [ ] State parameter validation
  - [ ] Error handling
- [ ] `server/api/__tests__/integrations/google-calendar/sync.post.test.ts`
- [ ] `server/api/__tests__/integrations/google-photos/oauth/callback.test.ts`

### Household & Settings API (3 routes)

- [ ] `server/api/__tests__/household/verifyPin.post.test.ts` (rate limiting)
- [ ] `server/api/__tests__/household/settings.put.test.ts`

---

## Phase 4: Composable Unit Tests (Complete in 3-4 weeks)

### Critical Composables (Priority Order)

- [ ] `app/__tests__/composables/useCalendarEvents.test.ts` (100+ lines)
  - [ ] fetchEvents
  - [ ] createEvent (validation)
  - [ ] deleteEvent (broadcast)
  - [ ] Error handling
- [ ] `app/__tests__/composables/useTodos.test.ts` (80+ lines)
- [ ] `app/__tests__/composables/useShoppingLists.test.ts` (80+ lines)
- [ ] `app/__tests__/composables/useUsers.test.ts` (copy from TEST_EXAMPLES.md)
- [ ] `app/__tests__/composables/useSyncManager.test.ts` (150+ lines)
  - [ ] SSE connection
  - [ ] Message parsing
  - [ ] Client cleanup

### Utility Function Tests

- [ ] `app/__tests__/utils/error.test.ts`
  - [ ] getErrorMessage
  - [ ] Network error handling
- [ ] `app/__tests__/utils/optimistic.test.ts`
  - [ ] performOptimisticUpdate
  - [ ] Rollback on error
- [ ] `app/__tests__/utils/timezone.test.ts` (create if needed)

### Integration Types Tests

- [ ] `app/__tests__/types/integrations.test.ts`

---

## Phase 5: Advanced Tests (Complete in future sprints)

### Multi-Browser Testing

- [ ] Uncomment Firefox in playwright.config.ts
- [ ] Uncomment Safari in playwright.config.ts
- [ ] Run: `npm run test` (tests all browsers)

### Mobile Viewport Testing

- [ ] Add iPad viewport to playwright.config.ts
- [ ] Add Pixel 5 viewport to playwright.config.ts
- [ ] Create responsive design tests: `tests/responsive-ui.spec.ts`

### Performance Tests

- [ ] Create `tests/performance/reorder-large-list.spec.ts` (1000 items)
- [ ] Create `tests/performance/calendar-sync-speed.spec.ts`

### Accessibility Tests

- [ ] Create `tests/a11y/navigation.spec.ts`
- [ ] Create `tests/a11y/pin-dialog.spec.ts`

### Visual Regression Tests

- [ ] Add `@playwright/test` visual assertions
- [ ] Create `tests/visual/dashboard.spec.ts`
- [ ] Create `tests/visual/calendar.spec.ts`

---

## CI/CD Integration

### GitHub Actions (Add to .github/workflows/)

- [ ] Create `test.yml` workflow:
  ```yaml
  name: Tests
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: "20"
        - run: npm ci
        - run: npm run type-check
        - run: npm run lint
        - run: npm run test:unit
        - run: npm run test
        - uses: actions/upload-artifact@v3
          if: always()
          with:
            name: playwright-report
            path: playwright-report/
  ```

### Pre-commit Hook

- [ ] Create `.husky/pre-commit`:
  ```bash
  #!/bin/sh
  npm run type-check && npm run lint && npm run test:unit
  ```
- [ ] Setup with `npx husky install`

### Test Reporting

- [ ] Configure HTML report opening on failure
- [ ] Setup Slack notifications on CI failure
- [ ] Add test coverage badge to README

---

## Test Maintenance

### Regular Tasks

- [ ] Review test results weekly
- [ ] Fix flaky tests immediately
- [ ] Update tests when features change
- [ ] Expand coverage as new features added
- [ ] Refresh test data fixtures monthly

### Metrics to Track

- [ ] Test count (target: 100+ tests by end of Phase 4)
- [ ] Code coverage (target: 80%+ by end of Phase 4)
- [ ] Test execution time (target: <5 min for all tests)
- [ ] Flakiness rate (target: 0%)
- [ ] CI pass rate (target: >95%)

---

## Estimated Timeline

| Phase                   | Duration      | Tests Created  |
| ----------------------- | ------------- | -------------- |
| Phase 1: Setup          | 1 day         | 0              |
| Phase 2: Critical Paths | 1-2 weeks     | 15-20          |
| Phase 3: API Routes     | 2-3 weeks     | 40-50          |
| Phase 4: Composables    | 3-4 weeks     | 20-25          |
| Phase 5: Advanced       | 2-3 weeks     | 15-20          |
| **Total**               | **~2 months** | **~100 tests** |

---

## Success Criteria

### Phase 1 (Setup) ✅

- [ ] `npm test` runs without errors
- [ ] `npm run test:unit` runs without errors
- [ ] Test directories exist and are empty
- [ ] playwright.config.ts updated
- [ ] package.json has test scripts

### Phase 2 (Critical Paths) ✅

- [ ] Chore workflow test passes
- [ ] Reward workflow test passes
- [ ] Calendar event test passes
- [ ] Shopping list test passes
- [ ] Todo kanban test passes
- [ ] All 15+ tests pass on CI

### Phase 3 (API Routes) ✅

- [ ] 40+ API route tests written
- [ ] All critical path tests pass
- [ ] No test flakiness
- [ ] > 80% API route coverage

### Phase 4 (Composables) ✅

- [ ] All 18 composables have tests
- [ ] All utility functions tested
- [ ] > 80% code coverage overall
- [ ] <5 minute test execution time

### Phase 5 (Advanced) ✅

- [ ] Multi-browser tests pass
- [ ] Mobile viewport tests pass
- [ ] No accessibility issues
- [ ] Visual regressions tracked

---

## Resources

- **Playwright docs:** https://playwright.dev
- **Vitest docs:** https://vitest.dev
- **Testing Library Vue:** https://testing-library.com/docs/vue-testing-library
- **SkyLite-UX TEST_EXAMPLES.md:** Copy-paste test templates
- **SkyLite-UX TEST_COVERAGE_ANALYSIS.md:** Feature-by-feature gaps

---

## Notes

- Start with E2E tests (catch most bugs fastest)
- API tests are easier to write (less UI complexity)
- Unit tests are most maintainable long-term
- Don't over-mock (use real Prisma if possible in tests)
- Keep test data fixtures DRY
- Review test output weekly for patterns
