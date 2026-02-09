# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkyLite-UX is an **open-source alternative to Skylight Calendar**, a self-hosted family management web app. Built with Nuxt 4, Vue 3, and TypeScript, deployed via Docker.

**Core features**: Family calendar (Google Calendar two-way sync, iCal), chores system with points, rewards marketplace, weather (Open-Meteo, OpenWeatherMap, Home Assistant), photo screensaver (Google Photos, Immich), task lists, shopping lists (Mealie, Tandoor integration), meal planning, parent/child user roles.

## Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run preview          # Preview production build

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
npm run type-check       # TypeScript type checking

# Testing (Playwright)
npm test                 # Run all tests
npm run test:ui          # Interactive test UI
npm run test:headed      # Run tests in headed browser
npm run test:settings    # Run settings regression tests only

# Database
npx prisma migrate dev   # Create and apply migrations
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Database GUI

# Initial setup
cp .env.example .env     # Then configure settings
npm install && npx prisma generate && npx prisma migrate dev
```

## Architecture

### Nuxt 4 File Structure

Uses Nuxt 4's `app/` directory with `future.compatibilityVersion: 4`.

- **`app/pages/`**: File-based routing — index, calendar, chores, rewards, toDoLists, shoppingLists, mealPlanner, lists, screensaver, settings
- **`app/components/`**: Auto-imported, organized by feature (calendar/, chores/, global/, settings/, shopping/, todos/, weather/)
- **`app/composables/`**: Auto-imported state management (no Pinia — uses composables pattern)
- **`app/integrations/`**: Client-side integration configs and service factories
- **`app/plugins/`**: Ordered initialization: `01.logging` → `02.appInit` → `03.syncManager.client`
- **`app/types/`**: Shared TypeScript types
- **`server/api/`**: Nitro API routes (RESTful: `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `index.post.ts`)
- **`server/integrations/`**: Server-side integration implementations (each has `client.ts`, `index.ts`, `types.ts`)
- **`server/plugins/`**: `01.logging` → `02.syncManager` (configured in `nuxt.config.ts` under `nitro.plugins`)

### Key Architectural Patterns

**State management**: Composables, not Pinia stores. Key composables: `useCalendarEvents()`, `useTodos()`, `useTodoColumns()`, `useShoppingLists()`, `useUsers()`, `useWeather()`, `useScreensaver()`, `useSyncManager()`, `useGlobalLoading()`, `useAlertToast()`.

**Global components**: `globalAppLoading`, `globalSideBar`, `globalDock` are statically imported in `app.vue` (explicitly excluded from auto-import chunking in `nuxt.config.ts`).

**Dialog pattern**: `*Dialog.vue` components for CRUD modals using Nuxt UI's `UModal`.

**Sync Manager**: Server plugin polls enabled integrations at configured intervals and broadcasts updates via SSE. Client composable `useSyncManager()` listens for real-time updates.

**Integration system**: Plugin architecture with registry in `app/integrations/integrationConfig.ts`. Service factories keyed as `"type:service"` (e.g., `"calendar:iCal"`, `"shopping:mealie"`). Integration types: `calendar`, `shopping`, `weather`, `photos`. To add an integration: create folder in `server/integrations/[name]/`, implement interfaces from `app/types/integrations.ts`, register in `integrationConfig.ts`.

### Database

PostgreSQL with Prisma ORM. Schema in `prisma/schema.prisma`. Prisma client singleton at `app/lib/prisma.ts` — import as `import prisma from "~/lib/prisma"`.

Key model groups:
- **Users**: `User` (with `UserRole` enum: PARENT/CHILD), `UserPoints`
- **Calendar**: `CalendarEvent`, `CalendarEventUser` (many-to-many), `CalendarEventMapping` (Google sync tracking)
- **Tasks**: `TodoColumn` → `Todo` (columnar kanban)
- **Shopping**: `ShoppingList` → `ShoppingListItem`
- **Chores/Rewards**: `Chore` → `ChoreCompletion`, `Reward` → `RewardRedemption`
- **Settings**: `HouseholdSettings` (family name, chore mode, parent PIN), `ScreensaverSettings`, `Integration`
- **Caching**: `WeatherCache`, `PhotoAlbum`, `PhotoCache`

### Timezone Handling

All timestamps stored in UTC. Global timezone set via `NUXT_PUBLIC_TZ` (default: `America/Chicago`). Always convert to/from UTC using the global TZ for display and storage. Date manipulation uses `date-fns`.

## Code Conventions

### ESLint Rules (enforced)

- Double quotes, semicolons required
- camelCase filenames (exceptions for README.md, CLAUDE.md, docker-compose files)
- `no-console`: warn — use `consola` instead (levels: trace, debug, info, warn, error, start)
- `node/no-process-env`: error — use Nuxt runtime config instead
- `ts/consistent-type-definitions`: use `type` not `interface`
- Vue: max 2 attributes per line (singleline), 1 per line (multiline)
- Import sorting enforced by perfectionist plugin

### Logging

Always use `consola`, never `console.log`. Log level configured from `NUXT_PUBLIC_LOG_LEVEL` runtime config, set in both client and server plugins.

## Environment Variables

Required: `DATABASE_URL`

Google OAuth (for Calendar/Photos): `NUXT_GOOGLE_CLIENT_ID`, `NUXT_GOOGLE_CLIENT_SECRET`, `NUXT_GOOGLE_REDIRECT_URI`, `NUXT_OAUTH_ENCRYPTION_KEY` (generate: `openssl rand -hex 32`)

Optional: `NUXT_PUBLIC_TZ`, `NUXT_PUBLIC_LOG_LEVEL`

Note: Home Assistant URL/token and OpenWeatherMap API key are configured through the Settings UI, not environment variables.

## Design Philosophy

UI mimics Skylight Calendar: clean, family-friendly, optimized for touchscreen/tablet/wall-mounted displays. Large tappable elements, user color coding, bright pastel palette, minimal distractions.
