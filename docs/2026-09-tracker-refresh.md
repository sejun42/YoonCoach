# September 2026 Tracker Refresh

## Daily Workflow

- The primary navigation contains Weight, Body Parts, and Settings only.
- The home URL and the old graph URL redirect to /weights.
- Weight input, graph periods, monthly calendars, and unsaved settings survive tab switches.
- Previous diet/check-in and coaching screens remain available from Settings.
- Chest, shoulders, back, front legs, back legs, biceps, and triceps can be selected together.
- Legacy arms and legs remain separate, visible records. They are not guessed or duplicated into new categories.
- Recommendations use each current category's last recorded date through the device's local today. Unrecorded categories come first.
- CSV export includes weight, workout body parts, diet/check-ins, and coaching history.

## Data Preservation and Deployment

This release targets the existing PostgreSQL/Supabase installation. No tables,
columns, or records are dropped. The new enum upgrade adds only biceps and triceps
and is safe to run again.

The production build now runs the specific additive upgrade instead of a general
prisma db push:

```sh
npm run build
```

Configure DATABASE_URL and DIRECT_URL for the existing PostgreSQL database in
the deployment environment. The previously connected Vercel project deploys main.
Do not use production credentials for local test data.

The existing migrations include older SQLite history, so do not run a reset or
replay that history against the live PostgreSQL installation. For an entirely new
empty PostgreSQL development database, initialize it deliberately from
prisma/schema.prisma before using this upgrade command.

## Performance and Cache Boundaries

The authenticated tracker layout stays mounted. Its three URLs use the native
History API, integrated with Next's pathname state, so tab changes do not wait
for server component requests. Browser back/forward and direct URLs still work.

SWR owns a cache scoped to one mounted user workspace. Weights are fetched once
and shared by the chart and history; goal changes update the same cached plan.
Workout calendars request one month plus grouped last-training dates. Successful
edits update cached months immediately, with normal reconnect/focus revalidation.
Full logout discards the workspace cache.

The service worker caches only immutable Next static assets and the public icon.
Authenticated HTML, APIs, and server-component responses are never cached.
Existing installed-app identity and start URL are unchanged.

## Verification

```sh
npm ci
npm run lint
npm run build:check
npx playwright install chromium
npm run test:e2e
```

build:check compiles without accessing or modifying the live database.
The browser suite starts an isolated, in-memory PGlite PostgreSQL server on
127.0.0.1:55432 and the production Next build on 127.0.0.1:3100. It overrides all
database and session credentials with test-only values. Neither .env data nor
the live Supabase database is used for test records.

Coverage includes repeating the actual production upgrade command, legacy records, user scoping,
past-date multi-selection and editing, failed-save draft retention, native
back/forward, tab request counts, shared weight/goal cache, CSV exports, date
validation, and layouts at 320, 390, 768, and 1280 pixels.

Three pre-existing lint warnings in seed.js, CheckinCalendar.tsx, and db.ts remain;
the refreshed code has no lint errors.
