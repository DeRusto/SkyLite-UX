# Planned: Calendar event dialog on GlobalDialog

**Status:** Planned (not started)

## Background

The upstream `2026.10.0` merge took upstream's `app/components/calendar/calendarEventDialog.vue` as-is, because upstream rewrote it for its recurring-event and Google Calendar fixes. The fork's own changes to that dialog did not carry over. The rest of the app's dialogs (shopping, to-do, chores, rewards) still use the shared `GlobalDialog` component, so the calendar event dialog is now the odd one out.

## Fork behaviour to bring back

These existed on fork `main` before the merge and should be re-applied on top of upstream's dialog rather than restoring the old file:

1. **GlobalDialog wrapper**: the standard dialog look used across the app, including the full-screen bottom sheet on mobile.
2. **Unsaved-changes warning**: confirm before closing when the form is dirty (`hasUnsavedChanges`).
3. **Double-submit guard**: disable Save while a request is in flight (`isSubmitting`).
4. **Title validation**: require a title before saving ("Title is required").
5. **Child components**: `calendarEventRecurrence.vue` and `calendarEventUserSelector.vue` are still in the tree but no longer used. Either wire them back in, or delete them if upstream's inline versions are kept.

## Approach

- Keep upstream's event logic (recurrence handling, Google Calendar branch, instance editing) untouched, and change only the shell and form-state behaviour.
- Port each item above as its own small change so later upstream syncs stay easy to merge.
- Verify on a phone-width viewport and on a wall-mounted tablet layout.
