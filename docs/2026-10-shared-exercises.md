# Weekly shared exercise catalog

Users can opt in under Settings → 운동 종목 공유. The default remains private for
every existing and new account. Opting in schedules all unpublished personal
exercises and future additions for the next Monday at 09:00 Asia/Seoul. The
immediate-share button publishes only the authenticated user's own catalog.

Custom exercises already reside in PostgreSQL. `publicAt` gates availability on
server reads, so the scheduled release needs no browser session, background job,
Vercel Cron secret, deployment, or maintenance task. The server includes entries
whose publication timestamp has passed on the next library request. Published
entries remain available when weekly sharing is disabled; future releases are
canceled. Re-enabling schedules only unpublished entries for the next release.

Only exercise ID, name, equipment and tags enter another user's catalog. User
IDs, personal settings, workouts, routines, notes and progress remain scoped to
the authenticated owner. Publishing retains the exercise ID and never updates
session JSON, routines or preferences. The picker suppresses duplicate public
names within the same equipment type, retaining personal identities and using
the earliest public identity. Validation still accepts accessible hidden IDs so
existing saved records can be edited. Creating a selectable duplicate is rejected.

The repeatable `20261026010000_shared_exercises` upgrade only adds a nullable
publication timestamp/index and an opt-in flag. It runs in the existing production
build upgrade chain. Sharing operations and exercise creation use the same
per-user transaction lock, avoiding an unscheduled record racing with opt-in.

Validation: Monday/year boundary calculation, release-time visibility, private
and cross-user isolation, opt-in/out and immediate publication, duplicate names,
stable histories/preferences, shared-exercise recording by another user, settings
UI and the existing workout suite. Tests use isolated PGlite; production data is
never used by the test runner.
