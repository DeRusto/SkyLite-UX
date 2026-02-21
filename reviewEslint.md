# ESLint Review Findings

**Date:** 2026-02-21
**Total Issues:** 44 errors, 0 warnings
**Command:** `npm run lint`

---

## Summary

The project has 44 ESLint violations across multiple files. Most violations are **filename case violations** which are easily fixable. There are also 3 more serious code quality issues that require manual code corrections.

**Top Rule Violations:**
1. `unicorn/filename-case` - 37 violations (84%)
2. `unused-imports/no-unused-vars` - 3 violations (7%)
3. `ts/no-use-before-define` - 2 violations (5%)
4. Parsing error - 1 violation (2%)

---

## Critical Rule Violations

### 1. Parsing Error (Code Syntax Issue)

**Rule:** `[parser-error]`
**Severity:** ERROR - Prevents linting

- **File:** `/Users/brandonwinterton/github/SkyLite-UX/RESPONSIVE_UI_VERIFICATION.md:595:8`
  - **Issue:** Parsing error - `;` expected
  - **Description:** Markdown file being linted as code. Contains a TypeScript code block in markdown that ESLint is attempting to parse. The inline code block at line 595 has incomplete syntax.
  - **Fix:** Either exclude .md files from ESLint or move TypeScript examples to separate code files.

---

## High Priority Violations

### 1. Variable Used Before Definition

**Rule:** `ts/no-use-before-define`
**Severity:** ERROR - Logic error

- **File:** `/Users/brandonwinterton/github/SkyLite-UX/scripts/benchmarkTodos.ts:15:5`
  - **Issue:** `consola` used before it was defined
  - **Description:** `consola` is imported at line 2 but is also imported again at line 31 inside the main function. The variable at line 15 refers to the outer scope import. However, there are duplicate imports (line 2 and lines 30-34) that need reorganization.
  - **Root Cause:** Lines 30-34 have imports that should be at the top of the file, not inside the function body.
  - **Fix:** Move all imports to the top of the file before line 6.

- **File:** `/Users/brandonwinterton/github/SkyLite-UX/scripts/benchmarkTodos.ts:28:3`
  - **Issue:** `consola` used before it was defined
  - **Description:** Same issue as above - imports should be hoisted to file top.
  - **Root Cause:** Lines 30-34 contain imports that must be moved to the top.
  - **Fix:** Move imports to the top level.

### 2. Unused Variables

**Rule:** `unused-imports/no-unused-vars`
**Severity:** ERROR - Dead code

- **File:** `/Users/brandonwinterton/github/SkyLite-UX/tests/responsive-ui.spec.ts:227:11`
  - **Issue:** `isVisible` is assigned a value but never used
  - **Description:** Variable `const isVisible = await monthView.isVisible().catch(() => false);` is assigned but the result is not used. The variable should either be used in an assertion or prefixed with `_` to mark it as intentionally unused.
  - **Location:** Line 227: `const isVisible = await monthView.isVisible().catch(() => false);`
  - **Fix:** Either use the variable in an assertion or rename to `_isVisible`.

- **File:** `/Users/brandonwinterton/github/SkyLite-UX/tests/responsive-ui.spec.ts:348:11`
  - **Issue:** `scrollHeight` is assigned a value but never used
  - **Description:** Variable `const scrollHeight = await contentArea.evaluate((el) => { return el.scrollHeight > el.clientHeight; });` is assigned but never used. Same issue as above.
  - **Location:** Line 348: `const scrollHeight = await contentArea.evaluate(...)`
  - **Fix:** Either use the variable in an assertion (the comparison is already done in the evaluate, so this looks like incomplete code) or rename to `_scrollHeight`.

---

## Medium Priority Violations

### 1. Filename Case Violations

**Rule:** `unicorn/filename-case`
**Severity:** ERROR - Code style convention

These 37 violations are filename case issues where uppercase filenames should be camelCase. These are mainly documentation files that were generated but don't match the project's naming convention. According to the ESLint config at line 36-47, these exceptions are excluded:
- README.md
- CLAUDE.md
- LICENSE.md
- AGENTS.md
- docker-compose files
- clear-completed.post.ts

**Files to Rename:**

1. `/Users/brandonwinterton/github/SkyLite-UX/RESPONSIVE_UI_INDEX.md` → `responsiveUiIndex.md` (1 violation)

2. `/Users/brandonwinterton/github/SkyLite-UX/RESPONSIVE_UI_TEST_RESULTS.md` → `responsiveUiTestResults.md` (7 violations across the file)

3. `/Users/brandonwinterton/github/SkyLite-UX/RESPONSIVE_UI_VERIFICATION.md` → `responsiveUiVerification.md` (27 violations across the file including the parsing error)

4. `/Users/brandonwinterton/github/SkyLite-UX/TESTING_SUMMARY.md` → `testingSummary.md` (6 violations across the file)

5. `/Users/brandonwinterton/github/SkyLite-UX/tests/responsive-ui.spec.ts` → `tests/responsiveUi.spec.ts` (1 violation)

**Note:** Most of these appear to be generated documentation files from test runs. Consider:
- Adding these files to `.eslintignore` if they're generated (recommended)
- Or renaming them to follow camelCase convention (simpler fix)
- Or adding them to the ESLint config `ignore` array under `unicorn/filename-case`

---

## Fix Priority Roadmap

### Immediate (Blocking):
1. **Fix `scripts/benchmarkTodos.ts`** - Move imports to top level (5 minutes)
   - Move lines 30-34 to lines 2-4 (after the first import and before `const prisma`)

2. **Fix unused variables in `tests/responsive-ui.spec.ts`** - Remove or use (5 minutes)
   - Line 227: Either remove or use `isVisible` in an assertion
   - Line 348: Either remove or use `scrollHeight` in an assertion (appears incomplete)

### High Priority:
3. **Rename 5 markdown and test files** - Update filenames (1 minute)
   - Either rename files or add to `.eslintignore`
   - Recommended: Create `.eslintignore` with pattern `*.md` to exclude all markdown files from ESLint

### Verification:
After fixes, run:
```bash
npm run lint
```

Expected result: 0 errors, 0 warnings

---

## Analysis & Recommendations

### Root Causes

1. **Generated Files:** Several markdown files (RESPONSIVE_UI_*, TESTING_SUMMARY.md) appear to be generated documentation with timestamps. These should be excluded from linting.

2. **Import Hoisting Issue:** The `benchmarkTodos.ts` script has imports incorrectly placed inside the `main()` function body instead of at the file top level. This is a common mistake when building scripts incrementally.

3. **Test Code Cleanup:** The test file has variables assigned for debugging or future use but not currently consumed. The `scrollHeight` variable looks particularly suspicious - the `.evaluate()` callback is computing `el.scrollHeight > el.clientHeight` (a boolean) but storing it in a variable that's never used, suggesting incomplete test logic.

### ESLint Configuration Notes

The project uses `@antfu/eslint-config` with Nuxt, which is excellent but strict:
- `unicorn/filename-case` is properly configured with exceptions for known files
- The config sensibly warns on `console` usage (should use `consola`)
- TypeScript checking is enabled (`ts/no-use-before-define`)

### Recommended Additional Rules

1. Add `.eslintignore` to exclude markdown files:
   ```
   *.md
   docs/**
   ```

2. Consider pre-commit hook to catch these before commit:
   ```bash
   npm run lint
   ```

---

## Files Affected Summary

| File | Type | Violations | Severity |
|------|------|-----------|----------|
| scripts/benchmarkTodos.ts | Script | 2 | HIGH |
| tests/responsive-ui.spec.ts | Test | 3 | HIGH |
| RESPONSIVE_UI_INDEX.md | Docs | 1 | MEDIUM |
| RESPONSIVE_UI_TEST_RESULTS.md | Docs | 7 | MEDIUM |
| RESPONSIVE_UI_VERIFICATION.md | Docs | 28 | MEDIUM |
| TESTING_SUMMARY.md | Docs | 6 | MEDIUM |
| **Total** | | **44** | |

---

**Status:** Ready for fixes
**Estimated Fix Time:** 10-15 minutes
**Regression Risk:** Very low - fixes are straightforward
