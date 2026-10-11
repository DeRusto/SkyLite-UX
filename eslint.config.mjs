// @ts-check
import antfu from "@antfu/eslint-config";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(antfu({
  type: "app",
  vue: true,
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
  // Ignores: union of upstream's list and the fork's additions (fork-only
  // docs, markdown, Playwright artifacts, and the fork's tests/ directory).
  ignores: [".pnpm-store/**", "**/migrations/*", ".gitignore", ".devcontainer/**", ".github/**", "docker-compose-example.yaml", "docker-compose-dev.yaml", "./docs/**", "test/**", "docs/**", ".playwright-cli/**", "**/*.md", "tests/**", "test-results.json"],
}, {
  rules: {
    "vue/max-attributes-per-line": ["error", {
      singleline: {
        max: 2,
      },
      multiline: {
        max: 1,
      },
    }],
    "ts/no-redeclare": "off",
    "ts/no-explicit-any": "error",
    "ts/consistent-type-definitions": ["error", "type"],
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "perfectionist/sort-imports": ["error", {
      tsconfigRootDir: ".",
    }],
    "unicorn/filename-case": ["error", {
      case: "camelCase",
      ignore: [
        "README.md",
        "CLAUDE.md",
        "LICENSE.md",
        "AGENTS.md",
        /docker-compose\.yml$/i,
        /-docker-compose\.yml$/i,
        /clear-completed\.post\.ts$/i,
      ],
    }],
  },
}));
