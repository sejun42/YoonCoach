# Routine sharing and workout editor, October 2026

## Sharing

Open **루틴 불러오기 → 내 루틴 → 공유 icon** to generate a QR and copyable URL. QR pixels are generated locally by `qrcode`; no third-party QR service receives the URL.

`RoutineShare` is an explicit, unguessable-link snapshot of a saved routine. Only the name, ordered exercises, tags, main flags, set count and set types are shared. Weight, reps and machine settings are cleared. The snapshot updates when the owner presses share again. Deleting the original routine or ending link sharing revokes access. Existing recipient copies remain independent. Re-sharing after revocation creates a new token.

The public preview requires no login. Import requires authentication and preserves the destination across login/signup, including an expired session. A shared routine is copied once per recipient/token; retrying never overwrites a recipient's edits. Existing routines with the same name are preserved and the copy receives a suffix. Existing exercise identities are reused when accessible. Private machines are copied into the recipient's private exercise collection, with collision-safe names. Imports use a transaction and account locks shared with custom exercise creation. Imported private machines are not automatically scheduled for global publication.

Migration `20261027000000_routine_shares` is additive and repeatable. Existing workout/routine JSON and IDs remain intact. No personal history is copied or overwritten.

## Recording

- **교체** on each exercise opens the same keyboard-aware picker. It replaces the exercise at the same index, keeps the main flag and set/type template, and applies the replacement's own saved machine settings. Entered values require confirmation before clearing. The saved routine changes only if the user explicitly saves that routine again.
- Moving a card animates its old-to-new position for 320ms, including its neighbour. Reduced-motion preferences disable the movement. An accessible live announcement reports the new position.
- Tap a set number for **일반 / 미니세트 / 드랍세트**. A segment is one row; type labels do not invent or aggregate extra reps. Each completed row continues to count once in existing volume/representative-part calculations. Optional `type` keeps all preexisting sets valid as normal sets.
- Set types survive five-second autosave, local recovery, manual save, routine templates, sharing, detailed history and CSV exports. Copy-above continues to copy only weight/reps, preserving the target row's type.

## Visual design

The app uses a cobalt-accented dark palette with distinct page, card and input surfaces. Dialogs, charts, tooltips, navigation, auth, and PWA theme colours are updated. Three SVG logo concepts live at `/logo-concepts/index.html`; the current icon is retained until the user chooses a design.

## Validation

Isolated PGlite migration replay and browser/API tests cover sharing ownership/revocation, private-machine import, repeated import, name collisions, QR preview and signup return, replacement confirmation/order, set recovery/export, motion/reduced motion, and 320/390/768/1280px layouts. Existing autosave and workout regressions are rerun. Production user data is never used for test mutations.
