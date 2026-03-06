# Architecture Refactoring Implementation Plan

Created: 2026-03-04
Status: PENDING
Approved: Yes
Iterations: 0
Worktree: Yes

> **Status Lifecycle:** PENDING -> COMPLETE -> VERIFIED
> **Iterations:** Tracks implement->verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes`
> **Worktree:** Set at plan creation (from dispatcher). `Yes` uses git worktree isolation; `No` works directly on current branch

## Summary

**Goal:** Refactor the 6 most problematic files identified in the architecture review to bring all components and composables under the 300-line target (500-line hard limit). Split oversized Vue components into focused sub-components, decompose the god composable into focused utilities, standardize API error handling, and improve plugin initialization resilience.

**Architecture:** Facade pattern for useCalendar (maintains existing API while delegating to focused composables). Component extraction pattern for Vue files (parent becomes orchestrator, logic moves to child components). Centralized error handling for API routes via Nitro middleware and shared utilities.

**Tech Stack:** Vue 3 + Nuxt 4, TypeScript, Prisma, Nitro server

## Scope

### In Scope

- Split `calendarEventDialog.vue` (1404 lines -> ~200 line orchestrator + sub-components)
- Split `settings.vue` (1249 lines -> ~200 line page container + section components)
- Split `settingsScreensaver.vue` (959 lines -> ~150 line orchestrator + sub-components)
- Decompose `useCalendar.ts` (803 lines -> ~200 line facade + 3 focused composables)
- Create API error standardization utilities and middleware
- Improve plugin initialization resilience in `02.appInit.ts`

### Out of Scope

- State management centralization (composable mutation patterns) - Medium term per review
- Integration registry refactoring - Medium term per review
- Composable testing infrastructure (vitest/jest setup) - Medium term per review
- Request lifecycle management (debouncing, AbortController) - Medium term per review
- Error boundaries for Vue 3 - Long term per review
- Splitting `globalDateHeader.vue` (502 lines) or `globalWeekView.vue` (391 lines) - Separate effort
- Changes to database schema, types, or Prisma models
- UI/UX behavioral changes - all refactoring preserves identical user experience

## Prerequisites

- Node.js and npm installed
- PostgreSQL database running with `DATABASE_URL` configured
- `npm install` and `npx prisma generate` completed

## Context for Implementer

> This section is critical for cross-session continuity. Write it for an implementer who has never seen the codebase.

- **Patterns to follow:** Vue components use `<script setup lang="ts">` with Composition API. Composables use `export function useXxx()` pattern (see `app/composables/useStableDate.ts` for a clean small example). API routes use `defineEventHandler` with try/catch (see `server/api/calendar-events/index.post.ts`).
- **Conventions:** Double quotes, semicolons required. `consola` for logging (never `console.log`). `type` not `interface` for TS types. camelCase filenames. Import sorting enforced by perfectionist plugin.
- **Key files:**
  - `app/composables/useCalendar.ts` (803 lines) - God composable being decomposed. 10 consumer files import from it.
  - `app/components/calendar/calendarEventDialog.vue` (1404 lines) - Largest component, handles event creation/editing with recurrence, user selection, iCal parsing.
  - `app/pages/settings.vue` (1249 lines) - Settings page with users, integrations (PIN-protected), household calendars, screensaver, app settings, about sections.
  - `app/components/settings/settingsScreensaver.vue` (959 lines) - Screensaver config with photo source selection, Immich albums, people/pets.
  - `app/plugins/02.appInit.ts` (198 lines) - App initialization plugin: timezone fetch, core data loading, integration service initialization. Exports `integrationServices` Map (a singleton) — this is imported by settings.vue for service lifecycle management.
  - `server/utils/security.ts` and `server/utils/oauthCrypto.ts` - Two existing server utility files. Task 8 adds `apiErrors.ts` as the third.
  - `app/integrations/immich/immichPhotos.ts` - Defines `ImmichPerson` type (shape: `{id, name, thumbnailPath}`) — different from the screensaver's people/pets type (Task 7 creates a separate type file).
- **Gotchas:**
  - `useCalendar` has 10 consumers. The facade pattern MUST preserve the exact return signature to avoid breaking changes.
  - `settings.vue` integrations section is PIN-protected with complex unlock state. The PIN dialog refs and unlock logic must stay coordinated.
  - `settingsScreensaver.vue` mounts `SettingsImmichAlbumSelector` and `SettingsImmichPeopleSelector` which already exist as separate components.
  - Nuxt auto-imports composables from `app/composables/` - new composables there are automatically available.
  - Components in `app/components/` are also auto-imported by Nuxt.
  - `02.appInit.ts` exports `integrationServices` Map which is imported by `settings.vue` (line 13).
- **Domain context:** This is a family calendar/management app for wall-mounted displays. The calendarEventDialog handles both native events and integration-synced events (Google Calendar, iCal). The settings page manages users, integrations, and screensaver config.

## Runtime Environment

- **Start command:** `npm run dev` (port 3000)
- **Build:** `npm run build`
- **Type checking:** `npm run type-check`
- **Linting:** `npm run lint`

## Feature Inventory

> This is a refactoring task - every function and UI section must map to a task.

### Files Being Refactored

| File | Lines | Functions/Sections | Mapped to Task |
|------|-------|-------------------|----------------|
| `app/composables/useCalendar.ts` | 803 | getSafeTimezone, getUtcMidnightTime, isSameUtcDay, createICalTime, isSameLocalDay, isLocalDayInRange, createLocalDate, getLocalWeekDays, getLocalMonthWeeks, getLocalAgendaDays, getLocalTimeFromUTC, createLocalDateTime, convertLocalToUTC | Task 1 |
| `app/composables/useCalendar.ts` | 803 | getLocalTimeString, getLocalDateString, getEventDisplayTime, getEventStartTimeForInput, getEventEndTimeForInput, getEventEndDateForInput | Task 1 |
| `app/composables/useCalendar.ts` | 803 | parseHexRGB, lightenColor, getLuminance, getTextColor, getAverageTextColor, getEventUserColors, getEventColorClasses, combineEvents | Task 1 |
| `app/composables/useCalendar.ts` | 803 | allEvents computed, calendarSyncStatus, refreshCalendarData, getIntegrationEvents, isToday, handleEventClick, scrollToDate, computedEventHeight, isSelectedDate, handleDateSelect, getMiniCalendarWeeks, getAgendaEventsForDay, getAllEventsForDay, getEventsForDateRange, isPlaceholderEvent, createPlaceholderEvent, sortEvents, return statement | Task 2 |
| `app/components/calendar/calendarEventDialog.vue` | 1404 | Recurrence refs/options (lines 66-154), recurrence watchers (328-339), toggleRecurrenceDay, parseICalEvent, resetRecurrenceFields, generateICalEvent RRULE portion, recurrence template (lines 1147-1331) | Task 3 |
| `app/components/calendar/calendarEventDialog.vue` | 1404 | User selector template (lines 1342-1372), selectedUsers ref, user selection click handlers | Task 3 |
| `app/components/calendar/calendarEventDialog.vue` | 1404 | Time conversion utilities (to12Hour, to24Hour, getRoundedCurrentTime, addMinutesTo12Hour), time refs, time watchers, updateEndTime, updateStartTime, isStartTimeAfterEndTime | Task 3 |
| `app/components/calendar/calendarEventDialog.vue` | 1404 | Props, emits, form state, permission computed, unsaved changes, handleClose, resetForm, handleSave, handleDelete, core form template, GlobalDialog wrapper | Task 4 |
| `app/pages/settings.vue` | 1249 | User CRUD handlers (handleUserSave, handleUserDelete, openUserDialog), Users template section (lines 717-800) | Task 5 |
| `app/pages/settings.vue` | 1249 | Integration status tracking, integration CRUD, toggle handler, tab management, PIN protection, Integrations template (lines 838-1028) | Task 6 |
| `app/pages/settings.vue` | 1249 | Household calendar logic (availableCalendars, getLinkedCalendarsByType, toggleHouseholdCalendar, updateHouseholdColor), template (lines 1030-1120) | Task 5 |
| `app/pages/settings.vue` | 1249 | Page layout, color mode, about section, dialog mounts, household settings section | Task 6 |
| `app/components/settings/settingsScreensaver.vue` | 959 | Core settings template: enable/disable, duration, idle timeout, transition, clock (lines 423-532) | Task 7 |
| `app/components/settings/settingsScreensaver.vue` | 959 | Photo source selector + album selection UI (lines 534-731) | Task 7 |
| `app/components/settings/settingsScreensaver.vue` | 959 | People & Pets selector (lines 734-956) | Task 7 |
| `server/api/**/*.ts` | 96 files | Error handling patterns (try/catch, createError, validation) | Task 8 |
| `app/plugins/02.appInit.ts` | 198 | Timezone fetch, core data loading, integration service init | Task 9 |

### Feature Mapping Verification

- [x] All old files listed above
- [x] All functions/classes identified
- [x] Every feature has a task number
- [x] No features accidentally omitted

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Extract focused composables from useCalendar.ts
- [x] Task 2: Refactor useCalendar.ts as facade composable
- [x] Task 3: Extract sub-components from calendarEventDialog.vue
- [ ] Task 4: Slim calendarEventDialog.vue to orchestrator
- [ ] Task 5: Extract users + household calendars from settings.vue
- [ ] Task 6: Extract integrations section + useIntegrationStatus + slim settings.vue
- [ ] Task 7: Split settingsScreensaver.vue into sub-components
- [ ] Task 8: API error standardization
- [ ] Task 9: Plugin initialization resilience

**Total Tasks:** 9 | **Completed:** 3 | **Remaining:** 6

## Implementation Tasks

### Task 1: Extract Focused Composables from useCalendar.ts

**Objective:** Extract 3 focused composables from the 803-line useCalendar.ts god composable, each under 150 lines.

**Dependencies:** None

**Files:**

- Create: `app/composables/useTimezone.ts`
- Create: `app/composables/useEventFormatting.ts`
- Create: `app/composables/useEventColors.ts`
- Test: Type checking passes, lint passes

**Key Decisions / Notes:**

- **⚠️ CRITICAL: Use `export function useXxx()` composable pattern — NOT standalone exports.** Multiple functions in these files call `useStableDate()` (which uses Vue `useState()` internally). Calling them as bare module-level functions outside a composable context throws a Nuxt runtime error: "useState is called outside plugin, component or composable." They must be wrapped in proper composable functions.

- **useTimezone.ts** (~200 lines): Export as `export function useTimezone()`. Internally call `const { parseStableDate, getStableDate } = useStableDate()`. Functions included: `getSafeTimezone`, `getUtcMidnightTime`, `isSameUtcDay`, `createICalTime`, `isSameLocalDay`, `isLocalDayInRange`, `getLocalTimeFromUTC`, `createLocalDate`, `getLocalWeekDays`, `getLocalMonthWeeks`, `getLocalAgendaDays`, `createLocalDateTime`, `convertLocalToUTC`. These also depend on `ical.js` and `getBrowserTimezone`/`isTimezoneRegistered` from `~/types/global`.

- **useEventFormatting.ts** (~80 lines): Export as `export function useEventFormatting()`. Internally call `const { getLocalTimeFromUTC } = useTimezone()`. Functions included: `getLocalTimeString`, `getLocalDateString`, `getEventDisplayTime`, `getEventStartTimeForInput`, `getEventEndTimeForInput`, `getEventEndDateForInput`.

- **useEventColors.ts** (~130 lines): Export as `export function useEventColors()`. Internally call `const { parseStableDate } = useStableDate()` — required because `combineEvents` calls `parseStableDate` 6 times and `getEventColorClasses` calls it at lines 529-530. Functions included: `parseHexRGB`, `lightenColor`, `getLuminance`, `getTextColor`, `getAverageTextColor`, `getEventUserColors`, `getEventColorClasses`, `combineEvents`. Note: `combineEvents` uses `getEventUserColors` so they belong together. `getEventColorClasses` is a large function (~115 lines) — keep it as-is since splitting it further would harm readability.

- Return pattern: each composable returns an object of its functions, e.g. `return { getSafeTimezone, getUtcMidnightTime, ... }`.
- Follow `export function useXxx()` pattern, not `export default`.

**Definition of Done:**

- [ ] `useTimezone.ts` exists with all timezone/date utility functions extracted
- [ ] `useEventFormatting.ts` exists with all formatting functions extracted
- [ ] `useEventColors.ts` exists with all color utility functions extracted
- [ ] Each new file is under 200 lines
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors

---

### Task 2: Refactor useCalendar.ts as Facade Composable

**Objective:** Refactor useCalendar.ts to import from the 3 extracted composables and re-export everything through the same public API. Reduce useCalendar.ts to ~200 lines while preserving identical behavior for all 11 consumers.

**Dependencies:** Task 1

**Files:**

- Modify: `app/composables/useCalendar.ts`
- Test: Type checking passes, build succeeds

**Key Decisions / Notes:**

- Replace inline function definitions with destructured imports from useTimezone(), useEventFormatting(), useEventColors() — call these composables inside the `useCalendar()` function body
- Keep IN useCalendar.ts: `allEvents` computed (lines 329-383), `calendarSyncStatus`, `refreshCalendarData`, `getIntegrationEvents`, view helper functions (`isToday`, `handleEventClick`, `scrollToDate`, `computedEventHeight`, `isSelectedDate`, `handleDateSelect`, `getMiniCalendarWeeks`, `getAgendaEventsForDay`, `getAllEventsForDay`, `getEventsForDateRange`, `isPlaceholderEvent`, `createPlaceholderEvent`, `sortEvents`), and the return statement
- The return statement MUST preserve ALL of these exact keys — no additions, no removals, no renames: `allEvents`, `calendarSyncStatus`, `nativeEvents`, `refreshCalendarData`, `getIntegrationEvents`, `isToday`, `handleEventClick`, `scrollToDate`, `computedEventHeight`, `isSelectedDate`, `handleDateSelect`, `getMiniCalendarWeeks`, `getAgendaEventsForDay`, `getAllEventsForDay`, `getEventsForDateRange`, `createPlaceholderEvent`, `isPlaceholderEvent`, `sortEvents`, `lightenColor`, `getTextColor`, `getLuminance`, `getAverageTextColor`, `getEventColorClasses`, `combineEvents`, `getEventUserColors`, `getLocalTimeFromUTC`, `getLocalTimeString`, `getLocalDateString`, `getEventDisplayTime`, `getEventStartTimeForInput`, `getEventEndTimeForInput`, `getEventEndDateForInput`, `createLocalDateTime`, `convertLocalToUTC`, `isSameLocalDay`, `isLocalDayInRange`, `createLocalDate`, `getLocalWeekDays`, `getLocalMonthWeeks`, `getLocalAgendaDays`
- 10 consumer files will be verified: `calendar.vue`, `globalWeekView.vue`, `globalMonthView.vue`, `globalDayView.vue`, `globalAgendaView.vue`, `calendarEventItem.vue`, `calendarMainView.vue`, `calendarEventDialog.vue`, `useCalendarEvents.ts`, `useCalendarIntegrations.ts`
- None of the consumers need changes if the facade preserves the return type

**Definition of Done:**

- [ ] `useCalendar.ts` calls useTimezone(), useEventFormatting(), useEventColors() within its function body and spreads/destructures their returns
- [ ] `useCalendar.ts` is under 250 lines
- [ ] Return statement contains all 36 keys listed in Key Decisions (no additions, removals, or renames)
- [ ] All 10 consumer files type-check successfully without modification
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run build` — successful build

---

### Task 3: Extract Sub-Components from calendarEventDialog.vue

**Objective:** Extract the recurrence UI, user selector, and time utilities into separate files to prepare for the orchestrator slim-down.

**Dependencies:** Task 2

**Files:**

- Create: `app/components/calendar/calendarEventRecurrence.vue`
- Create: `app/components/calendar/calendarEventUserSelector.vue`
- Create: `app/composables/useCalendarEventTime.ts`
- Test: Type checking passes

**Key Decisions / Notes:**

- **CalendarEventRecurrence.vue** (~250 lines): Extract all recurrence state (refs: `isRecurring`, `recurrenceType`, `recurrenceInterval`, `recurrenceEndType`, `recurrenceCount`, `recurrenceUntil`, `recurrenceDays`, `recurrenceMonthlyType`, `recurrenceMonthlyWeekday`, `recurrenceYearlyType`, `recurrenceYearlyWeekday`), option arrays, functions (`toggleRecurrenceDay`, `parseICalEvent`, `resetRecurrenceFields`, `generateICalEvent`), the recurrence watcher (lines 328-339), and the recurrence template block (lines 1147-1331).
- **⚠️ CRITICAL — prop-driven parsing pattern to avoid immediate-watcher timing failure:** The parent's `watch(() => props.event, ..., { immediate: true })` fires synchronously during setup before child template refs resolve. To avoid null ref failures: CalendarEventRecurrence accepts an `icalEvent: ICalEvent | null` prop. It internally watches this prop with `{ immediate: true }` and calls `parseICalEvent` itself. The parent sets `:ical-event="currentIcalEvent"` where `currentIcalEvent` is a ref updated from `props.event.ical_event`. This way the child's watch fires within the CHILD's setup context — not the parent's — so all child state is in scope.
- For resetting: parent sets `currentIcalEvent` to `null` when the event is cleared; child's watcher fires and calls `resetRecurrenceFields`.
- For GENERATION on save (needs `start: Date, end: Date` from parent): use `defineExpose({ buildICalEvent: (start: Date, end: Date) => ICalEvent })` and call via template ref in parent's `handleSave`. This is safe because `handleSave` only runs after user interaction (after mount), so the template ref is guaranteed to be resolved.
- **CalendarEventUserSelector.vue** (~80 lines): Extract user selection UI (template lines 1342-1372). Props: `users: User[]`, `modelValue: string[]`, `isReadOnly: boolean`. Emits: `update:modelValue`.
- **useCalendarEventTime.ts** (~60 lines): Export as `export function useCalendarEventTime()`. Extracts time conversion utilities: `to12Hour`, `to24Hour`, `getRoundedCurrentTime`, `addMinutesTo12Hour`. These are pure functions that do NOT call useStableDate so a simple composable wrapper is fine.
- Do NOT modify calendarEventDialog.vue yet — just create the new files. Task 4 wires them together.

**Definition of Done:**

- [x] `calendarEventRecurrence.vue` contains all recurrence UI, state, and logic
- [x] `calendarEventUserSelector.vue` contains user selection UI with v-model pattern
- [x] `useCalendarEventTime.ts` contains time conversion utilities
- [x] `npm run type-check` passes with 0 errors
- [x] `npm run lint` passes (new files clean; pre-existing stale analysis .md files in worktree root have filename-case errors unrelated to this task)

**Implementation Notes (for Task 4):**

- `calendarEventRecurrence.vue` exposes `{ buildICalEvent, resetRecurrenceFields, isRecurring, recurrenceDays }` via `defineExpose`. The parent accesses these via template ref.
- `buildICalEvent(start, end)` returns an `ICalEvent` with `uid: ""` and `summary: ""` as placeholders — Task 4's `handleSave` must spread in `uid`, `summary`, `description`, `location`, and `attendees` from parent state.
- The "Repeat" checkbox (`UCheckbox v-model="isRecurring"`) lives INSIDE `calendarEventRecurrence.vue` (not in the parent), so Task 4 removes lines 1140-1145 from `calendarEventDialog.vue`.
- `calendarEventUserSelector.vue` has an `isNewEvent: boolean` prop to control the label text ("Select..." vs "Edit..."). Pass `:is-new-event="!event?.id"` from parent.
- The `recurrenceUntil` watcher (originally lines 328-339) has been moved into `calendarEventRecurrence.vue` — remove it from `calendarEventDialog.vue` in Task 4. Also remove the recurrence `if` block from the `watch(startDate, ...)` watcher (the component now watches `props.startDate` directly).

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors (new files only)

---

### Task 4: Slim calendarEventDialog.vue to Orchestrator

**Objective:** Refactor calendarEventDialog.vue to use the extracted sub-components and composable, reducing it from 1404 lines to ~250 lines.

**Dependencies:** Task 3

**Files:**

- Modify: `app/components/calendar/calendarEventDialog.vue`
- Test: Type checking, lint, build

**Key Decisions / Notes:**

- Import and use `CalendarEventRecurrence`, `CalendarEventUserSelector`, `useCalendarEventTime`
- Replace inline recurrence template with `<CalendarEventRecurrence :ical-event="currentIcalEvent" :is-read-only="isReadOnly" :start-date="startDate" ref="recurrenceRef" />`
- Add `const currentIcalEvent = ref<ICalEvent | null>(null)` — updated inside the `props.event` watcher to pass recurrence data to the child
- Replace inline user selector with `<CalendarEventUserSelector v-model="selectedUsers" :users="users" :is-read-only="isReadOnly" />`
- Replace inline time conversion functions with `const { to12Hour, to24Hour, getRoundedCurrentTime, addMinutesTo12Hour } = useCalendarEventTime()`
- Keep in calendarEventDialog.vue: form state refs, time state refs, permission computed props, unsaved changes logic, date/time watchers, `handleSave`, `handleDelete`, `resetForm`, main template with date pickers and time selectors, and the GlobalDialog wrapper
- In `handleSave`: call `const icalEvent = recurrenceRef.value!.buildICalEvent(start, end)` — safe because user interaction guarantees mount
- Preserve the watch on `props.event` (lines 357-476), but remove the `parseICalEvent`/`resetRecurrenceFields` calls from it (replaced by setting `currentIcalEvent`)

**Definition of Done:**

- [ ] `calendarEventDialog.vue` is under 550 lines (realistic: ~480-530 after extractions; handleSave is 172 lines + props.event watcher is 121 lines, both must stay)
- [ ] Recurrence UI renders via CalendarEventRecurrence component
- [ ] User selector renders via CalendarEventUserSelector component
- [ ] `npm run dev` starts successfully and the calendar event dialog opens/edits recurring events correctly
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors
- `npm run build` — successful build

---

### Task 5: Extract Users + Household Calendars from settings.vue

**Objective:** Extract the Users section and Household Calendars section from settings.vue into focused components.

**Dependencies:** None

**Files:**

- Create: `app/components/settings/settingsUsersSection.vue`
- Create: `app/components/settings/settingsHouseholdCalendars.vue`
- Modify: `app/pages/settings.vue`
- Test: Type checking, lint

**Key Decisions / Notes:**

- **SettingsUsersSection.vue** (~200 lines): Extract user management — `handleUserSave`, `handleUserDelete`, `openUserDialog`, user grid template (lines 717-800), `SettingsUserDialog` mount. Props: none (uses `useUsers()` composable directly). Emits: `userSaved` (to trigger calendar sync in parent).
- **SettingsHouseholdCalendars.vue** (~180 lines): Extract household calendar linking — `availableCalendars` computed, `getLinkedCalendarsByType`, `toggleHouseholdCalendar`, `updateHouseholdColor`, `linkedHolidayCalendars`, `linkedFamilyCalendars`, template (lines 1030-1120). Props: `householdSettings: any`, `integrations: Integration[]`. Emits: `update:householdSettings`, `triggerSync`.
- After extraction, update settings.vue to mount these components where the inline sections were
- The calendar sync trigger from user save (lines 237-246 in settings.vue) should be handled via an event emitted by SettingsUsersSection

**Definition of Done:**

- [ ] `settingsUsersSection.vue` contains all user management UI and logic
- [ ] `settingsHouseholdCalendars.vue` contains all calendar linking UI and logic
- [ ] `settings.vue` mounts extracted components in place of inline sections
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run lint` passes

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors

---

### Task 6: Extract Integrations Section + Slim settings.vue

**Objective:** Extract the PIN-protected Integrations section and reduce settings.vue to a ~200 line page container.

**Dependencies:** Task 5

**Files:**

- Create: `app/components/settings/settingsIntegrationsSection.vue`
- Create: `app/composables/useIntegrationStatus.ts`
- Modify: `app/pages/settings.vue`
- Test: Type checking, lint, build

**Key Decisions / Notes:**

- **SettingsIntegrationsSection.vue** (~550 lines): Extract all integration management — status tracking (`fetchIntegrationStatus`, `getIntegrationStatus`, `isStatusLoading`), CRUD handlers (`handleIntegrationSave`, `handleIntegrationDelete`, `openIntegrationDialog`), toggle handler (`handleToggleIntegration`), tab management, PIN protection state, integration helpers (`getIntegrationIcon`, `getIntegrationTypeLabel`, `getIntegrationIconUrl`), integrations template (lines 838-1028), `SettingsIntegrationDialog` and `SettingsPinDialog` mounts.
- **⚠️ CRITICAL**: `SettingsIntegrationsSection.vue` MUST import `integrationServices` from `~/plugins/02.appInit` and replicate the `integrationServices.set()` and `integrationServices.delete()` mutations from `settings.vue` lines 479, 491, 528, 538. This is a load-bearing side effect for integration service lifecycle — type-check will NOT catch if it's omitted.
- To keep `SettingsIntegrationsSection.vue` under the 500-line hard limit: also extract `useIntegrationStatus` composable (~60 lines) containing `fetchIntegrationStatus`, `getIntegrationStatus`, `isStatusLoading` state and methods. This brings the component to ~490 lines.
- Props: `householdSettings: any`. This component manages its own PIN unlock state.
- After all extractions, `settings.vue` should contain: imports, color mode setup, `householdSettings` fetch, page layout shell, mounts for `SettingsUsersSection`, `SettingsIntegrationsSection`, `SettingsHouseholdCalendars`, `SettingsScreensaver` (already a component), household settings section, application settings section, about section, and `SettingsPinChangeDialog` mount.
- Target: settings.vue under 250 lines

**Definition of Done:**

- [ ] `settingsIntegrationsSection.vue` contains all integration management with PIN protection and imports `integrationServices` from `~/plugins/02.appInit`
- [ ] `useIntegrationStatus.ts` composable extracted and used by `settingsIntegrationsSection.vue`
- [ ] `settings.vue` is under 300 lines
- [ ] All dialog components are properly mounted (no orphaned dialogs)
- [ ] `npm run dev` starts and the integrations section renders with working toggle/status
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors
- `npm run build` — successful build

---

### Task 7: Split settingsScreensaver.vue into Sub-Components

**Objective:** Split the 959-line settingsScreensaver.vue into focused sub-components, reducing it to ~150 lines.

**Dependencies:** None

**Files:**

- Create: `app/types/screensaver.ts`
- Create: `app/components/settings/screensaverTimingControls.vue`
- Create: `app/components/settings/screensaverPhotoSource.vue`
- Create: `app/components/settings/screensaverPeopleSelector.vue`
- Modify: `app/components/settings/settingsScreensaver.vue`
- Test: Type checking, lint, build

**Key Decisions / Notes:**

- **ScreensaverTimingControls.vue** (~120 lines): Extract core settings UI — enable/disable toggle, photo display duration slider, idle timeout slider, transition effect select, show clock toggle (template lines 434-532). Props: `settings: ScreensaverSettingsData`. Emits: `save(updates: Partial<ScreensaverSettingsData>)`.
- **ScreensaverPhotoSource.vue** (~250 lines): Extract photo source selector + album selection — photo integration selector, single/multi source display, Immich sync button, sync status, album selector mounts for both Immich and Google Photos (template lines 534-731). Props: `settings: ScreensaverSettingsData`, `syncing: boolean`, `lastSync: Date | null`. Emits: `photoSourceChange`, `immichAlbumsSelected`, `googlePhotosAlbumsSelected`, `syncNow`.
- **ScreensaverPeopleSelector.vue** (~250 lines): Extract the Immich people/pets selection UI (template lines 734-956). Props: `people: ImmichPerson[]`, `pets: ImmichPerson[]`, `selectedPeople: string[]`, `loading: boolean`, `error: string | null`, `selectedAlbums: string[]`. Emits: `peopleSelected`, `retry`.
- The `settingsScreensaver.vue` becomes orchestrator: fetches settings, manages state, passes props to children, handles emitted events.
- Move `ScreensaverSettingsData` and `ImmichPerson` types to `app/types/screensaver.ts` for sharing between sub-components. Note: `app/integrations/immich/immichPhotos.ts` defines a DIFFERENT `ImmichPerson` type (`{id, name, thumbnailPath}`). The screensaver's `ImmichPerson` (`{id, name, birthDate, thumbnailUrl, type: "person"|"pet"}`) is a different, more detailed type from the Immich People API. They are NOT duplicates and should coexist under different import paths.

**Definition of Done:**

- [ ] `screensaverTimingControls.vue` renders all timing/display settings
- [ ] `screensaverPhotoSource.vue` renders photo source selection and albums
- [ ] `screensaverPeopleSelector.vue` renders people/pets selection grid
- [ ] `settingsScreensaver.vue` is under 200 lines
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run lint` — 0 lint errors
- `npm run build` — successful build

---

### Task 8: API Error Standardization

**Objective:** Create centralized error handling utilities and middleware to standardize API error responses across all 96 route files.

**Dependencies:** None

**Files:**

- Create: `server/utils/apiErrors.ts`
- Create: `server/middleware/errorHandler.ts`
- Modify: 3 representative API routes (calendar-events/index.post.ts, users/index.post.ts, shopping-lists to demonstrate pattern)
- Test: Type checking, build

**Key Decisions / Notes:**

- **server/utils/apiErrors.ts** (~60 lines): Export helper functions for common error patterns:
  - `createValidationError(field: string, message: string)` -> 400 with structured body
  - `createNotFoundError(resource: string, id: string)` -> 404
  - `createServerError(operation: string, error: unknown)` -> 500 with safe error message (no raw error objects in response)
  - `validateRequired(body: Record<string, unknown>, fields: string[])` -> throws validation error if fields missing
- **server/middleware/errorHandler.ts** (~30 lines): Nitro middleware that catches errors and formats them consistently. **⚠️ Important**: Nitro `onError` hooks intercept ALL errors including H3Errors thrown by `createError()`. The middleware MUST check `if (isError(error)) { return; }` (using `isError` from `h3`) to pass H3Errors through unchanged. Only reformat non-H3 errors (raw `Error` objects, unknown throws) into `{ statusCode: 500, message: "Internal server error" }` to prevent stack traces leaking to client.
- Update 3 representative routes to use the new utilities as examples. The remaining 93 routes can be migrated incrementally (out of scope for this plan, but the pattern is established).
- Nitro auto-imports from `server/utils/` and auto-registers middleware from `server/middleware/`.

**Definition of Done:**

- [ ] `server/utils/apiErrors.ts` exports validation, not-found, and server error helpers
- [ ] `server/middleware/errorHandler.ts` catches unhandled errors with consistent format
- [ ] At least 3 API routes updated to use new error utilities
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run build` — successful build

---

### Task 9: Plugin Initialization Resilience

**Objective:** Make `02.appInit.ts` more resilient by adding a timeout to timezone fetching, fallback behavior, and separating core vs extended data loading concerns.

**Dependencies:** None

**Files:**

- Modify: `app/plugins/02.appInit.ts`
- Test: Type checking, build

**Key Decisions / Notes:**

- Add a 5-second timeout to the timezone fetch. Current behavior: no timeout, can hang indefinitely on slow networks.
- **⚠️ Important**: The current code uses `useFetch` inside the plugin. `useFetch` in a plugin does not return a plain Promise — `Promise.race` against it will not work as expected. Replace the timezone fetch with `$fetch` + `AbortController`: `const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000); try { const data = await $fetch(url, { signal: controller.signal }); clearTimeout(timeoutId); ... } catch { /* fallback to UTC */ }`. This correctly aborts the underlying HTTP request on timeout.
- Make timezone fetch non-blocking with UTC fallback: if `$fetch` throws (timeout, network error, or parse error), catch it, log a warning, and continue — the app already has a `setTimezoneRegistered(false)` fallback path.
- Add retry logic (1 retry) for core data fetch (`Promise.all` for users/integrations). If retry fails, log error but let app render (data will show as loading).
- Add comments to clarify the initialization phases: Phase 1 (timezone, non-blocking), Phase 2 (core data: users, integrations - must succeed), Phase 3 (extended data: events, todos, shopping - can fail gracefully), Phase 4 (integration services - best effort).
- Keep the file under 250 lines after changes.

**Definition of Done:**

- [ ] Timezone fetch has a 5s timeout with UTC fallback
- [ ] Core data fetch has 1 retry with error logging
- [ ] Initialization phases are clearly separated with comments
- [ ] `02.appInit.ts` is under 250 lines
- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm run build` succeeds

**Verify:**

- `npm run type-check` — 0 type errors
- `npm run build` — successful build

---

## Testing Strategy

- **Type checking:** `npm run type-check` after every task — catches broken imports, missing types, signature mismatches
- **Linting:** `npm run lint` after every task — catches style violations, unused imports, consola violations
- **Build:** `npm run build` after tasks 2, 4, 6, 7, 8, 9 — full compilation test, catches template errors and missing imports
- **Runtime checkpoints** (catches behavioral regressions static analysis misses):
  - After Task 2: `npm run dev` → open calendar page → verify events render
  - After Task 4: `npm run dev` → open a recurring calendar event → verify recurrence fields populate correctly
  - After Task 6: `npm run dev` → open settings → verify PIN-protected integrations section loads and toggle works
  - After Task 7: `npm run dev` → open settings screensaver → verify photo source selector and people grid render
- **E2E tests:** `npm test` as final verification step (Playwright, requires dev server running)
- No unit test framework exists (only Playwright E2E). Adding vitest is out of scope per the architecture review.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking useCalendar consumers (10 files) | Medium | High | Facade pattern preserves all 36 exact return keys enumerated in Task 2. Type checking catches mismatches immediately. |
| Immediate watcher timing in calendarEventDialog | Addressed | — | Prop-driven approach: parent passes `icalEvent` prop to CalendarEventRecurrence, child parses internally. No template-ref timing issue for parsing. Build step only used for save generation. |
| integrationServices mutations in extracted component | Addressed | — | Task 6 explicitly requires importing `integrationServices` from `~/plugins/02.appInit` in settingsIntegrationsSection.vue. |
| PIN unlock state coordination in settings.vue extraction | Low | High | SettingsIntegrationsSection manages its own PIN state internally. Parent only passes householdSettings. |
| Nuxt auto-import conflicts with new composable names | Low | Medium | New composable names (useTimezone, useEventFormatting, useEventColors, useIntegrationStatus) are unique. Verify with type-check. |
| Nitro middleware intercepting H3Errors | Addressed | — | Task 8 explicitly uses `isError()` check to pass H3Errors through unchanged. Only raw errors are reformatted. |
| settingsScreensaver event/prop drilling complexity | Medium | Low | Use emit pattern consistently. Types enforce correct prop/emit contracts. |

## Open Questions

- None — all design decisions are resolved based on the architecture review findings and codebase exploration.

### Deferred Ideas

- Migrate remaining 93 API routes to use new error utilities (Task 8 only does 3 as examples)
- Add vitest unit test infrastructure for extracted composables
- Split globalDateHeader.vue (502 lines) and globalWeekView.vue (391 lines)
- Centralize state mutation patterns (useXxxMutations composables)
