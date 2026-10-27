# October 2026: workout journal

The existing Vercel/Next.js app now opens `/workouts/YYYY-MM-DD` from the training
calendar. Weight and nutrition screens retain their existing storage and behavior.

## Recording

- Brand/model-specific catalog entries retain stable IDs. Includes the supplied
  gym equipment, extra exercises for each region, and barbell/dumbbell rows.
- Each exercise starts with one blank set; add up to 50 sets and 60 exercises.
  Record kilograms (0–2000) and integer reps (1–1000). Empty and partially entered
  sets are saved but do not contribute to statistics. Every row has a copy button
  that inserts an independent copy of that row directly below it, including its
  weight, reps and set type; existing lower rows shift down unchanged. Copying is
  disabled for completely empty rows and at the 50-set limit. For bodyweight exercises,
  record added load, using 0 kg when unweighted. Keep a consistent convention for
  dumbbells and unilateral exercises; different machines are separate histories.
- One or two editable body-part tags per exercise. Main exercises can be marked.
  Representatives rank by completed main-set score, then total completed-set score,
  then a fixed tie order. Each set divides its score equally among its tags.
  Only two representatives are displayed. No kg-based comparison across muscles.
- The information button records seat height, chest pad, and up to ten additional
  named settings. Session snapshots preserve historical settings. Explicit saves
  update per-exercise defaults only when settings differ from that session's prior
  snapshot; editing old weights alone does not overwrite current settings.
- Save the exercise order, tags, main flags, and number of sets as a named routine.
  Loading a routine starts blank sets with the user's saved settings. Users can
  replace a routine by saving its existing name or delete it without deleting logs.
- Inputs are immediately staged in account/date-scoped local storage, then saved
  to PostgreSQL after five seconds without changes. The queue remains active
  across in-app navigation and attempts a save when the page becomes hidden.
  Each date has one in-flight write; later keystrokes keep their own draft and
  receive the acknowledged revision before the next save. Manual save remains.
- Failed requests keep local drafts and retry after 15 seconds or reconnect.
  Reloads restore partial and invalid inputs too. Recovered drafts and ambiguous
  writes reconcile against the server before retrying; different remote edits
  stop autosave with a conflict message and an exportable local draft. Identical
  retries are idempotent. Storage failures are visible and enable an unload
  warning. Clearing browser storage removes local recovery; loading the app
  itself still requires connectivity. Older versions had no durable draft backup.

## Progress

The bottom graph selects an individual exercise and a 30/90/180-day or full range.
Highest weight, maximum reps at a selected fixed weight, and total volume are
separate views. Missing comparison weights are gaps, not zeros. A single session
shows a point; two sessions are required for a delta. Future dates and empty sets
are excluded. Volume is sum(weight × reps), not an estimate of strength; zero-load
bodyweight progress is compared using reps. A table exposes sets and historical
machine settings. Saving/deleting records revalidates charts and calendar caches.

## Storage and deployment

`20261026000000_workout_sessions/migration.sql` creates WorkoutSession,
WorkoutRoutine, CustomExercise, and ExercisePreference and adds the `core` enum
value. It is additive and repeatable and is included in `npm run db:upgrade`, which
the production `build` runs. `build:check` generates the client and builds without
touching a database. Existing manual body-part logs are never overwritten by new
sessions: calendar reads prefer session representatives on recorded days and fall
back to manual logs on days without completed sets. CSV includes both old logs and
new sets, session notes, routines, custom exercises, and settings.

All endpoints require the existing session cookie and scope reads/writes to its
user ID. Exercise IDs must resolve to built-in or user-owned catalog entries.
Session saves use an advisory lock and optimistic revision checks; stale writes
return 409 without losing the local draft. Clearing a session retains its revision.

Run `npm run build:check`, then `npm run test:e2e`. The isolated PGlite test server
removes the new tables before applying the production upgrades twice and verifies
legacy data survives. No production database is used by the tests.
