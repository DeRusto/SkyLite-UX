# Responsive Calendar UI Design

## Date: 2026-02-14

## Goal

Make SkyLite-UX fully responsive with a pleasant, functional calendar experience on phone screens while preserving the existing wall-mounted/desktop experience untouched.

## Breakpoints & Layout Tiers

| Tier | Breakpoint | Letterbox | Navigation | Default View |
|------|-----------|-----------|------------|-------------|
| Phone | `< 640px` (below `sm`) | Off | Bottom tab bar | Agenda |
| Tablet | `640px-1024px` (`sm` to `lg`) | Off | Bottom tab bar | Month |
| Desktop/Wall | `> 1024px` (`lg+`) | On (16:9) | Left sidebar (current) | Month |

The letterbox wrapper in `app.vue` becomes conditional — only applied at `lg+`. Below that, the app fills the full screen.

## Bottom Tab Bar Navigation

Replaces the sidebar on `< lg` screens:

- Fixed to bottom, safe-area-aware (`pb-safe` for iPhone home indicator)
- 5 tabs: **Calendar**, **Chores**, **Lists**, **Meals**, **More**
- "More" opens a slide-up sheet with: Rewards, Settings, To-Do Lists
- Screensaver excluded from phone/tablet (wall-mounted feature only)
- Icon on top, small label below (iOS pattern)
- Active tab: primary color highlight
- Height: ~56px + safe area

The current 70px sidebar remains unchanged for `lg+` screens.

### Layout in `default.vue`

- `< lg`: full-width content, `padding-bottom` to clear the tab bar
- `lg+`: current flex layout with sidebar

## Calendar View Adaptations

All four views work on all screen sizes but adapt layout per tier.

### Agenda View (phone primary)

- Full-width scrolling list grouped by day
- Sticky date headers per day section
- Event cards: colored left border (user color), title, time range, avatars
- Tap event to open full-screen dialog
- 2 weeks of upcoming events, infinite scroll for more

### Month View (tablet primary)

- **Phone (`< sm`):** Stacked — compact mini month grid at top with colored dots as event indicators. Tap a day to show its events in a list below. Selected day highlighted.
- **Tablet (`sm` to `lg`):** Same stacked layout with more room — mini grid can show short event text or event counts.
- **Desktop (`lg+`):** Current full 7-column grid, unchanged.

### Week View

- **Phone (`< sm`):** Single day shown at a time, horizontal swipe between days (day carousel). Small date chips at top showing the full week for quick jumping.
- **Tablet (`sm` to `lg`):** 3-4 day columns side by side (reduced from current 4+3).
- **Desktop (`lg+`):** Unchanged.

### Day View

- **Phone (`< sm`):** Full-width event list, no side-by-side mini calendar. Mini calendar accessible via month view or date header.
- **Tablet (`sm` to `lg`):** Current 40/60 split (mini calendar + events).
- **Desktop (`lg+`):** Unchanged.

## Date Header & Navigation

### Phone/Tablet (`< lg`)

- Single compact row: **Today button** (left), **date/period label** (center), **view selector** (right)
- User filter via filter icon button in header
- Arrow buttons removed — replaced by swipe gestures on calendar content area
- Swipe left = next period, swipe right = previous period
- Works on all views: next/prev month, week, or day

### Desktop (`lg+`)

- Current header unchanged — arrows, today, view selector, user filter, export all visible.

### Gesture Implementation

- Touch events (`touchstart`/`touchend`) with 50px minimum horizontal threshold
- Subtle slide transition animation in swipe direction
- No swipe on event dialog or scrollable lists — only main calendar area

## Event Dialog — Mobile

### Phone/Tablet (`< lg`)

- Full-screen sheet sliding up from bottom (iOS pattern)
- Top bar: **Cancel** (left), **title** (center), **Save** (right)
- Swipe down on top handle to dismiss (unsaved changes confirmation if dirty)
- Full-width form inputs, vertical scroll
- Native mobile date/time pickers where possible
- Delete button at bottom of scroll (red, destructive)

### Desktop (`lg+`)

- Current centered modal unchanged.

### Animation

- Slide up with spring easing, backdrop fades in
- Dismiss: slide down

## View Persistence

- localStorage key: `skylite-calendar-view`
- Value: `"month"` | `"week"` | `"day"` | `"agenda"`
- On page load:
  1. Check localStorage for saved view
  2. If found, use it
  3. If not found (first visit), auto-select: `< sm` = agenda, `sm+` = month
- Saved whenever user changes view via selector

## Files Changed

| File | Change |
|------|--------|
| `app.vue` | Conditional letterbox — only `lg+` |
| `app/layouts/default.vue` | Responsive layout: bottom tab bar `< lg`, sidebar `lg+` |
| `app/components/global/globalSideBar.vue` | Hide on `< lg` |
| `app/components/global/globalDateHeader.vue` | Compact single-row on `< lg`, remove arrows |
| `app/components/global/globalMonthView.vue` | Stacked mini-month + day event list on `< lg` |
| `app/components/global/globalWeekView.vue` | Day carousel on `< sm`, 3-4 cols on tablet |
| `app/components/global/globalDayView.vue` | Full-width event list on `< sm` |
| `app/components/global/globalAgendaView.vue` | Full-width with sticky day headers |
| `app/components/calendar/calendarMainView.vue` | Swipe gestures, view persistence |
| `app/components/calendar/calendarEventDialog.vue` | Full-screen bottom sheet on `< lg` |

## New Components

| Component | Purpose |
|-----------|---------|
| `app/components/global/globalBottomTabBar.vue` | Bottom nav for phone/tablet |
| `app/components/global/globalMoreSheet.vue` | Overflow nav slide-up sheet |

## Constraints

- No changes to `lg+` screens — existing wall-mounted/desktop experience preserved
- Screensaver excluded from phone/tablet navigation
- All existing functionality maintained, only layout/presentation changes
