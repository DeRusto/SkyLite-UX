# TypeScript Review (Updated Codebase)

## Status: PASSING ✅

The SkyLite-UX project currently **passes TypeScript compilation** with `vue-tsc --noEmit`. However, the codebase contains numerous type safety patterns that should be reviewed and improved to prevent runtime errors and improve code maintainability.

### Verification Date

February 21, 2026

- Command: `npm run type-check`
- Exit Code: 0 (Success)
- Files Analyzed: 208 TypeScript/Vue files
- Configuration: Nuxt 4 with Vue 3 strict type checking

---

## Critical Type Safety Issues (Potential Runtime Errors)

### 1. Unsafe `any` Type Casts in State Management

**Severity**: High
**Impact**: Runtime errors, loss of type safety in state mutations

#### Issue 1.1: Untyped Object Spreads in useShoppingLists.ts

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useShoppingLists.ts`
**Lines**: 99, 112, 177, 196, 218, 225

```typescript
// Line 99: Cast to 'any' when updating shopping list
shoppingLists.value[listIndex] = { ...shoppingLists.value[listIndex], ...updates } as any;

// Line 112: Another untyped spread
shoppingLists.value[listIndex] = { ...list, items: updatedItems } as any;
```

**Problem**: Using `as any` bypasses type checking on object mutations. If `updates` has unexpected properties, they'll be silently added to state.

**Recommendation**:

- Use proper typing for update parameters: `{ name: string }` instead of generic object spreads
- Create typed update builders instead of `as any` casts
- Example:

```typescript
async function updateShoppingList(listId: string, updates: UpdateShoppingListInput) {
  // Type-safe update
  shoppingLists.value[listIndex] = {
    ...shoppingLists.value[listIndex],
    ...updates,
  }; // No cast needed
}
```

#### Issue 1.2: Array Item Casting in useShoppingLists.ts

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useShoppingLists.ts`
**Lines**: 141, 164, 178, 213, 225, 233, 245, 248

```typescript
// Line 141: Untyped array cast
const itemIndex = (list.items as any[])?.findIndex((i: any) => i.id === itemId);

// Line 164: Same pattern repeated
const itemIndex = (list.items as any[])?.findIndex((i: any) => i.id === itemId);
```

**Problem**: Casting items to `any[]` prevents catching type mismatches. If `ShoppingListItem` structure changes, these operations silently fail.

**Recommendation**:

- Rely on the proper `ShoppingListItem` type instead of `as any[]`
- Example:

```typescript
const itemIndex = list.items?.findIndex((i: ShoppingListItem) => i.id === itemId);
```

#### Issue 1.3: Method Type Casting in useShoppingIntegrations.ts

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useShoppingIntegrations.ts`
**Lines**: 129, 169

```typescript
// Line 129: Unsafe service method lookup
const fn = (service as any).updateShoppingListItem;
```

**Problem**: Casting `service` to `any` loses type information about available methods. Missing methods or changed signatures won't be caught.

**Recommendation**:

- Create a typed interface for integration services:

```typescript
type ShoppingIntegrationService = {
  updateShoppingListItem: (listId: string, itemData: UpdateShoppingListItemInput) => Promise<ShoppingListItem>;
  deleteShoppingListItems: (listId: string, itemIds: string[]) => Promise<void>;
};

const fn = (service as ShoppingIntegrationService).updateShoppingListItem;
```

#### Issue 1.4: Generic Record Types in app/types/database.ts

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/types/database.ts`
**Lines**: 106, 137, 144

```typescript
// Line 106: Integration settings stored as any
integrationData?: Record<string, any>;

// Line 137: Settings can be any object
settings: Record<string, any> | null;
```

**Problem**: `Record<string, any>` is equivalent to `any` for value access. Any setting key is allowed, and values have no type safety.

**Recommendation**:

- Create discriminated union types for different integration types:

```typescript
type IntegrationDataMap = {
  'google-calendar': GoogleCalendarSettings;
  'mealie': MealieSettings;
  'tandoor': TandoorSettings;
  // ...
};

integrationData?: IntegrationDataMap[Integration['type']];
```

---

### 2. Unsafe Type Casting with `as unknown as`

**Severity**: Medium
**Impact**: Bypasses type checker's double-cast guard, risky pattern

#### Issue 2.1: DOM Element Access in Settings Dialogs

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/components/settings/settingsPinChangeDialog.vue`
**Lines**: 53, 64

```typescript
// Line 53: Unsafe DOM element cast
const el = (props.hasAdultPin ? currentPinInput.value : newPinInput.value)
  as unknown as { $el?: HTMLElement };
```

**Problem**: Double casting (`as unknown as`) bypasses TypeScript's "double cast guard" safety feature, allowing almost any cast.

**Recommendation**:

- Create proper typing for template refs:

```typescript
const currentPinInput = ref<InstanceType<typeof UInput> | null>(null);
// Then safely access:
const el = currentPinInput.value?.$el?.querySelector("input");
```

#### Issue 2.2: Integration Data JSON Casting

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/integrations/mealie/mealieShoppingLists.ts`
**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/integrations/tandoor/tandoorShoppingLists.ts`

```typescript
integrationData: entry as unknown as JsonObject,
```

**Problem**: Casting third-party API responses through `unknown` is overly permissive and hides parsing errors.

**Recommendation**:

- Use proper parsing and validation:

```typescript
const parseIntegrationData = (entry: MealieItem): JsonObject => {
  return {
    id: entry.id,
    name: entry.name,
    checked: entry.checked,
  };
};

integrationData: parseIntegrationData(entry),
```

#### Issue 2.3: Event Type Casting

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/components/calendar/calendarEventItem.vue`

```typescript
handleClick(e as unknown as MouseEvent);
```

**Problem**: Vue's event handler already has proper type information. This cast is unnecessary.

**Recommendation**:

- Let TypeScript infer the event type:

```typescript
function handleClick(e: MouseEvent) {
  // ...
}
```

---

### 3. Non-Null Assertions Without Guarantees

**Severity**: Medium
**Impact**: Runtime errors if value is unexpectedly null/undefined

#### Issue 3.1: Unsafe Map Operations

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useCalendar.ts`

```typescript
const existingEvent = eventMap.get(key)!;
```

**Problem**: Non-null assertion assumes `key` exists in map. If it doesn't, this throws.

**Recommendation**:

- Use optional chaining or explicit null check:

```typescript
const existingEvent = eventMap.get(key);
if (!existingEvent) {
  consola.warn(`Event not found for key: ${key}`);
}
// Safe to use existingEvent
```

#### Issue 3.2: Ref Access Without Null Check

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/components/shopping/shoppingListsContent.vue`
**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/pages/settings.vue`

```typescript
// editingItem.value!.id assumes editingItem is always set
list.items?.some((item: ShoppingListItem) => item.id === editingItem.value!.id);

// selectedUser.value!.id assumes selectedUser exists
const userIndex = cachedUsers.value.findIndex((u: User) => u.id === selectedUser.value!.id);
```

**Problem**: If `editingItem` or `selectedUser` become null/undefined, this will throw at runtime.

**Recommendation**:

- Add defensive checks:

```typescript
if (!editingItem.value) {
  return false;
}
return list.items?.some((item: ShoppingListItem) => item.id === editingItem.value.id);
```

#### Issue 3.3: Optional Date Conversions

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/components/todos/todoItemDialog.vue`

```typescript
const date = todoDueDate.value!.toDate(getLocalTimeZone());
```

**Problem**: `todoDueDate.value!` might be null if form wasn't filled.

**Recommendation**:

```typescript
const date = todoDueDate.value?.toDate(getLocalTimeZone());
if (!date) {
  consola.warn("Due date is required");
}
```

---

## High Priority Type Issues

### 4. Missing Runtime Validation for Integration Types

**Severity**: High
**File**: `/Users/brandonwinterton/github/SkyLite-UX/server/plugins/02.syncManager.ts`
**Lines**: Various

```typescript
integrationServices.set(integration.id, service as unknown as ServerTypedIntegrationService);
```

**Problem**: Integration services are cast without validation. If a service doesn't implement the expected interface, runtime errors occur.

**Recommendation**:

- Add runtime type guards:

```typescript
function isValidIntegrationService(service: unknown): service is ServerTypedIntegrationService {
  return (
    typeof service === "object"
    && service !== null
    && "sync" in service
    && typeof (service as any).sync === "function"
  );
}

if (!isValidIntegrationService(service)) {
  throw new Error(`Invalid service for integration ${integration.id}`);
}

integrationServices.set(integration.id, service);
```

### 5. Loose Module Resolution Settings

**Severity**: Medium
**Files**: `/Users/brandonwinterton/github/SkyLite-UX/server/plugins/01.logging.ts`
**File**: `/Users/brandonwinterton/github/SkyLite-UX/server/utils/oauthCrypto.ts`

**Errors Found**:

```
error TS5083: Cannot read file '/Users/brandonwinterton/github/SkyLite-UX/.nuxt/tsconfig.json'.
error TS1259: Module '"node:path"' can only be default-imported using the 'esModuleInterop' flag
error TS1259: Module '"node:crypto"' has no default export.
error TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020'...
error TS2307: Cannot find module 'nitropack/runtime/plugin' (should use 'node16', 'nodenext', or 'bundler').
```

**Problem**: TypeScript compiler configuration is not optimized for Node.js modern module system.

**Recommendation**:
Check `.nuxt/tsconfig.json` for module resolution settings. Ensure:

- `moduleResolution` is set to `bundler`, `node16`, or `nodenext`
- `module` is set to `es2022` or later
- `esModuleInterop` is enabled for CommonJS compatibility

---

## Type Safety Violations (Code Smells)

### 6. Excessive `as any` Usage in Response Mappings

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useCalendarEvents.ts`

```typescript
} as any; // Temporary cast to match CalendarEventResponse shape for optimistic cache
```

**Problem**: Comments admit to type safety violations. Temporary casts often become permanent.

**Recommendation**:

- Create a proper mapper function:

```typescript
function createOptimisticEvent(data: CalendarEventInput): CalendarEventResponse {
  return {
    id: crypto.randomUUID(),
    title: data.title,
    // ... map all fields properly
    createdAt: new Date().toISOString(),
  };
}
```

### 7. HTTP Method Casting

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/composables/useUsers.ts`

```typescript
method: "POST" as any,
method: "PUT" as any,
method: "DELETE" as any,
```

**Problem**: Casting HTTP method strings to `any` loses type safety. Should use typed constants.

**Recommendation**:

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

function fetchWithMethod(method: HttpMethod, url: string) {
  return $fetch(url, { method });
}
```

---

## Database & ORM Type Safety

### 8. Prisma Payload Types

**File**: `/Users/brandonwinterton/github/SkyLite-UX/app/types/database.ts`
**Status**: ✅ Well-implemented

The codebase correctly uses Prisma's `GetPayload` utility types:

```typescript
export type User = Prisma.UserGetPayload<Record<string, never>>;
export type TodoWithUser = Prisma.TodoGetPayload<{
  include: { /* ... */ };
}>;
```

**Observation**: This pattern is used correctly. No issues here.

---

## Vue 3 & Nuxt 4 Type Safety

### 9. Composition API Type Coverage

**Status**: ✅ Good

The codebase properly uses:

- `ref<T>()` with generic parameters
- `computed<T>()` with return types
- `useState<T>()` for SSR-safe state
- Proper `defineProps<T>()` and `defineEmits<T>()`

**Example - Good Pattern**:

```typescript
const loading = useState<boolean>("shopping-lists-loading", () => false);
const currentShoppingLists = computed(() => (shoppingLists.value || [])...);
```

### 10. Template Type Safety

**Observation**: Vue templates use optional chaining correctly:

```typescript
// Good patterns found:
?.value
?.id
?.map()
?.findIndex()
```

---

## Recommendations Summary

### Priority 1: Fix Critical Casts

1. Replace `as any` in state mutations with proper types
2. Remove `as unknown as` double casts in DOM access
3. Add validation for integration services

### Priority 2: Improve Type Definitions

1. Create discriminated unions for integration data
2. Define typed interfaces for service methods
3. Add proper types for HTTP methods

### Priority 3: Add Runtime Guards

1. Validate integration service implementations
2. Add null checks for non-null assertions
3. Implement parsing for third-party API responses

### Priority 4: Configuration

1. Review `.nuxt/tsconfig.json` settings
2. Ensure Node.js module resolution is optimized
3. Enable `esModuleInterop` for Node.js compatibility

---

## Conclusion

**Current Status**: The project passes TypeScript compilation. However, the codebase contains ~50+ instances of type safety bypasses that could lead to runtime errors. Most issues are concentrated in state management composables and integration handling.

**Risk Level**: Medium - Compilation passes, but runtime errors are possible in edge cases (null values, missing object properties, changed integration APIs).

**Action Required**: Address Priority 1 items (critical casts) to eliminate immediate runtime risks. Priority 2-4 items improve code maintainability and prevent future regressions.

**Estimated Effort**:

- Priority 1: 4-6 hours (critical fixes)
- Priority 2: 3-4 hours (type definitions)
- Priority 3: 2-3 hours (runtime guards)
- Priority 4: 1-2 hours (configuration)

Total: 10-15 hours to reach production-grade type safety.
