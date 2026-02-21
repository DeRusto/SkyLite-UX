# TypeScript Review Findings

## Summary

The SkyLite-UX project has **10 type errors** across 6 files, all stemming from missing imports in two composable files (`useBreakpoint.ts` and `useSwipe.ts`). These composables use Vue utilities but fail to import them, causing TypeScript to not recognize the functions when they are auto-imported into components.

## Critical Errors (Type Safety)

### 1. Missing Vue imports in useBreakpoint.ts

**File:** `app/composables/useBreakpoint.ts`

**Issue:** The composable uses `ref()`, `computed()`, and `onScopeDispose()` from Vue without importing them.

**Affected files (9 errors):**
- `app/app.vue(7,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/calendar/calendarEventDialog.vue(30,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/calendar/calendarMainView.vue(57,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/global/globalAgendaView.vue(18,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/global/globalDateHeader.vue(51,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/global/globalDayView.vue(20,35)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/global/globalFloatingActionButton.vue(24,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/components/global/globalMonthView.vue(29,23)`: error TS2304: Cannot find name 'useBreakpoint'
- `app/layouts/default.vue(5,23)`: error TS2304: Cannot find name 'useBreakpoint'

**Root cause:** `app/composables/useBreakpoint.ts` is missing:
```typescript
import { ref, computed, onScopeDispose } from 'vue'
```

Current implementation (lines 1-21):
```typescript
export function useBreakpoint() {
  const isDesktop = ref(true);  // ref not imported

  if (import.meta.client) {
    const query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;

    const handler = (e: MediaQueryListEvent) => {
      isDesktop.value = e.matches;
    };
    query.addEventListener("change", handler);

    onScopeDispose(() => {  // onScopeDispose not imported
      query.removeEventListener("change", handler);
    });
  }

  const isMobile = computed(() => !isDesktop.value);  // computed not imported

  return { isDesktop, isMobile };
}
```

**Severity:** CRITICAL - Prevents TypeScript from recognizing the composable function

---

### 2. Missing Vue imports in useSwipe.ts

**File:** `app/composables/useSwipe.ts`

**Issue:** The composable uses `Ref`, `onMounted()`, and `onUnmounted()` without importing them.

**Affected files (1 error):**
- `app/components/calendar/calendarMainView.vue(60,1)`: error TS2304: Cannot find name 'useSwipe'

**Root cause:** `app/composables/useSwipe.ts` is missing:
```typescript
import { Ref, onMounted, onUnmounted } from 'vue'
```

Current implementation (lines 6-52):
```typescript
export function useSwipe(el: Ref<HTMLElement | null>, callbacks: SwipeCallbacks, options?: { threshold?: number }) {
  // ... uses onMounted and onUnmounted without imports

  onMounted(() => {  // onMounted not imported
    const element = el.value;
    if (element) {
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchend", onTouchEnd, { passive: true });
    }
  });

  onUnmounted(() => {  // onUnmounted not imported
    const element = el.value;
    if (element) {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
    }
  });
}
```

**Severity:** CRITICAL - Prevents TypeScript from recognizing the composable function

---

## Type-Check Command Output

```
npm warn Unknown project config "shamefully-hoist". This will stop working in the next major version of npm.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm.

> skylite-ux@2026.1.0 type-check
> vue-tsc --noEmit -p tsconfig.json --composite false

app/app.vue(7,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/calendar/calendarEventDialog.vue(30,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/calendar/calendarMainView.vue(57,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/calendar/calendarMainView.vue(60,1): error TS2304: Cannot find name 'useSwipe'.
app/components/global/globalAgendaView.vue(18,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/global/globalDateHeader.vue(51,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/global/globalDayView.vue(20,35): error TS2304: Cannot find name 'useBreakpoint'.
app/components/global/globalFloatingActionButton.vue(24,23): error TS2304: Cannot find name 'useBreakpoint'.
app/components/global/globalMonthView.vue(29,23): error TS2304: Cannot find name 'useBreakpoint'.
app/layouts/default.vue(5,23): error TS2304: Cannot find name 'useSwipe'.
```

---

## Error Categories

### All 10 Errors: Missing Function Names (TS2304)

TS2304 errors indicate that TypeScript cannot find a name in the current scope. This occurs because:

1. **Root cause:** Two composable files lack the necessary Vue imports
2. **Effect:** Nuxt's auto-import system cannot properly type-check these composables
3. **Cascade:** When components try to use these composables via auto-import, TypeScript cannot resolve their names

### Why Auto-Import Isn't Preventing This

Nuxt's auto-import generates auto-imports at build time (stored in `.nuxt/auto-imports.d.ts`), but:
- Type-checking happens at strict compile time with `vue-tsc`
- The composables themselves must be valid TypeScript for auto-import to work
- Missing imports in the source composables break type resolution

---

## Recommendations

1. **Add imports to `app/composables/useBreakpoint.ts`:**
   ```typescript
   import { ref, computed, onScopeDispose } from 'vue'
   ```

2. **Add imports to `app/composables/useSwipe.ts`:**
   ```typescript
   import { Ref, onMounted, onUnmounted } from 'vue'
   ```

3. **Verify all other composables** in `app/composables/` for similar missing imports

4. **Re-run type-check** after fixes to confirm all errors are resolved

---

## No High/Medium Priority Errors

All errors fall into the critical category because they prevent the project from compiling with type safety. There are no warnings or lower-priority issues.
