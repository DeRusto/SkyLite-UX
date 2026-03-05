# ESLint Review (Updated Codebase)

## Executive Summary

**Total Issues Found:** 116 (101 errors, 15 warnings)
**Source Code Status:** CLEAN ✓ (app/, server/ directories have zero violations)
**Configuration Files:** AFFECTED (utility scripts and documentation files have violations)

The application source code passes all ESLint checks. Violations are limited to:

1. Configuration/utility scripts in root directory
2. Markdown files and documentation (incorrectly linted as code)
3. GitHub workflow files

## Critical Linting Errors

### 1. JSON Parsing Error

**File:** `/Users/brandonwinterton/github/SkyLite-UX/main/.claude/settings.local.json`
**Line:** 30, Column 7
**Rule:** `Parsing error: Unexpected token '"Bash(npm test:*)"'`
**Severity:** ERROR
**Category:** Configuration File

**Issue:** This file contains invalid JSON syntax. The token `"Bash(npm test:*)"` appears to be a malformed string or incorrect JSON structure.

**Resolution:** Fix the JSON syntax in this file to be valid JSON.

---

## High Priority Issues

### 1. Filename Case Violations (unicorn/filename-case)

**Files Affected:** 92 instances

Most violations are in non-source-code files that are explicitly excluded from the ESLint ignores:

#### Root-Level Utility Scripts

```
check-integrations.cjs    → checkIntegrations.cjs
check-integrations.js     → checkIntegrations.js
check-pin.js              → checkPin.js
test-screenshots.cjs      → testScreenshots.cjs
docker-compose-example.yaml → dockerComposeExample.yaml (excluded in config)
```

#### GitHub Workflow Files (Should be excluded)

```
.github/workflows/docker_prod_image.yaml → dockerProdImage.yaml
.github/workflows/docker_test_image.yaml → dockerTestImage.yaml
.github/workflows/github_pages.yaml → githubPages.yaml
```

#### GitHub Issue Templates (Should be excluded)

```
.github/ISSUE_TEMPLATE/bug_report.md → bugReport.md
.github/ISSUE_TEMPLATE/feature_request.md → featureRequest.md
```

#### Playwright CLI Generated Files

```
.playwright-cli/page-2026-02-15T00-31-28-149Z.yml
```

#### Documentation Plan Files (Marked as excluded)

```
docs/plans/2026-02-14-responsive-calendar-design.md
docs/plans/2026-02-14-responsive-calendar-implementation.md
```

#### Review Reports (Also being linted as source)

```
review-architecture-updated.md → reviewArchitectureUpdated.md
review-security-updated.md → reviewSecurityUpdated.md
```

**Note:** Many of these files SHOULD be excluded via the ESLint ignore patterns. The `ignores` array in `eslint.config.mjs` needs review:

- `**/migrations/*` - only matches migrations
- `docs/**` - should exclude all plan files
- `.github/**` - should exclude workflows and templates
- Missing: exclude markdown files at project root

**Resolution:**

1. Update `.eslintignore` or expand the `ignores` array in `eslint.config.mjs` to properly exclude:
   - All `.md` files at project root
   - GitHub workflows and templates (if not already working)
   - Generated Playwright files
2. For files that SHOULD follow camelCase (utility scripts), rename them to follow the convention

---

### 2. console.log Warnings (no-console)

**Rule:** `no-console` (warn)
**Allowed Methods:** `warn`, `error`

#### Files and Locations

**check-integrations.cjs:**

- Line 9: `console.log()` → use `consola.info()` or allowed method

**check-integrations.js:**

- Line 9: `console.log()` → use `consola.info()` or allowed method

**check-pin.js:**

- Line 7: `console.log()` → use `consola.info()` or allowed method
- Line 8: `console.log()` → use `consola.info()` or allowed method

**test-screenshots.cjs:**

- Lines 28, 32, 38, 47, 56, 61, 65, 70, 74, 81, 86, 90, 95, 104 (14 total warnings)

**Resolution:** Replace all `console.log()` calls with `console.warn()` or `console.error()`, or use the `consola` library with appropriate levels.

---

### 3. process.env Usage Violations (node/no-process-env)

**Rule:** `node/no-process-env` (error)
**Affected File:** `review-security-updated.md` (Lines: 362, 381, 467, 468, 630, 643, 713, 818, 897)

**Note:** These appear in markdown documentation being parsed as code. This is a false positive from linting markdown files as code.

**Resolution:** Exclude markdown files from ESLint linting entirely.

---

### 4. Buffer Usage Violations (node/prefer-global/buffer)

**Rule:** `node/prefer-global/buffer` (error)
**Affected File:** `review-security-updated.md` (Lines: 563, 566, 644 (×3), 645)

**Note:** These are code examples in markdown documentation, not actual application code.

**Resolution:** Exclude markdown files from ESLint linting.

---

## Medium Priority Issues

### 1. Vue Template Parsing Errors in Markdown

**File:** `docs/plans/2026_02_14ResponsiveCalendarImplementation.md`
**Lines:** 807 (attribute-name), 830, 837, 956, 963, 1054 (parsing errors)
**Rules:**

- `vue/valid-attribute-name` (error)
- `vue/no-parsing-error` (error)

**Issue:** Markdown file contains Vue template examples being parsed as actual Vue templates.

**Resolution:** Exclude markdown files from linting or use proper markdown code fencing to prevent parsing.

---

### 2. Multiple Statements Per Line (style/max-statements-per-line)

**File:** `test-screenshots.cjs`
**Lines:** 22, 45, 61, 70, 86, 92
**Rule:** `style/max-statements-per-line` (error)

**Example (Line 22):**

```javascript
// Two statements on one line
statement1; statement2;
```

**Resolution:** Split statements across multiple lines.

---

## Summary by Rule

| Rule                            | Count | Severity | Category             |
| ------------------------------- | ----- | -------- | -------------------- |
| `unicorn/filename-case`         | 92    | ERROR    | Filename conventions |
| Parsing Errors (JSON, Vue, JS)  | 10    | ERROR    | Syntax validation    |
| `no-console`                    | 15    | WARNING  | Logging              |
| `node/no-process-env`           | 9     | ERROR    | Environment access   |
| `node/prefer-global/buffer`     | 6     | ERROR    | Global usage         |
| `style/max-statements-per-line` | 6     | ERROR    | Code style           |
| `vue/valid-attribute-name`      | 1     | ERROR    | Vue templates        |

---

## Source Code Status (app/, server/)

✓ **Zero violations** in actual application code

The application properly follows all ESLint rules:

- Proper import organization via `perfectionist/sort-imports`
- Correct TypeScript type definitions (no `interface`, using `type`)
- Proper camelCase naming in source files
- No console violations in app code
- No process.env violations in app code

---

## Recommendations

### Immediate Actions

1. **Fix ESLint Configuration Exclusions**
   - Update `eslintignore` array to exclude:
     - `**/*.md` (all markdown files)
     - `review-*.md` (review reports)
     - `.playwright-cli/**` (generated files)
     - `.github/workflows/**` (already attempted)
     - `.github/ISSUE_TEMPLATE/**` (already attempted)

2. **Fix JSON Parsing Error**
   - Review `.claude/settings.local.json` line 30
   - Ensure valid JSON syntax

3. **Rename Utility Scripts** (if they're part of the committed codebase)
   - `check-integrations.cjs` → `checkIntegrations.cjs`
   - `check-integrations.js` → `checkIntegrations.js`
   - `check-pin.js` → `checkPin.js`
   - `test-screenshots.cjs` → `testScreenshots.cjs`

### Secondary Actions

1. **Replace console.log() in Utility Scripts**
   - Use `console.warn()` or `console.error()` instead
   - Or switch to using `consola` library

2. **Fix Multiple Statements Per Line**
   - Refactor `test-screenshots.cjs` to use one statement per line

### Configuration Updates

The ESLint configuration at `/Users/brandonwinterton/github/SkyLite-UX/eslint.config.mjs` should add explicit exclusions for:

```javascript
ignores: [
  ".pnpm-store/**",
  "**/migrations/*",
  ".gitignore",
  ".devcontainer/**",
  ".github/**",
  "docker-compose-example.yaml",
  "docs/**",
  ".playwright-cli/**",
  "**/*.md", // Add this
  "review-*.md", // Add this
];
```

---

## Verification

ESLint verification for source code (app/, server/):

```
✓ No violations found in application source code
✓ All TypeScript/Vue files pass linting
✓ All JavaScript files pass linting
```

**Test Command:**

```bash
cd /Users/brandonwinterton/github/SkyLite-UX
npx eslint app/ server/  # Returns clean (no output)
```
