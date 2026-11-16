# Ride sounds: a hard start and stop, no fades. Opus, high (audio timing). Targeted lane

Branch `claude/ride-sound-hard` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-14-ride-sounds.md`.

**Eric, Nov 16:** "for all the noises/audio for the rides ... forget the fade in and out, it should be a hard start and stop when you
start moving and stop. Like boingo, it sounds better this way and not laggy."

Today (`packages/app/src/ride-sound.ts`, `RIDE_SOUND` in `packages/core/src/settings.ts`): a loop ride fades in (`fadeInMs` 60), an
engine's speed rises from `engine.startRate` 0.8 over `upMs` 300; it stops `holdMs` (120) after the last moving frame and fades out
(`fadeOutMs` 300-700) while an engine sinks to `stopRate`; moving mid-fade comes back from where it was.
**Do:** the loop starts at full level and speed on the first moving frame, and stops at once when the hold ends (only the few-ms de-click
the Sound switch already uses, `SILENCE_S`, if a bare stop clicks: listen). Remove the fade and engine ramps and their settings
(`fadeInMs`, `fadeOutMs`, `engine.startRate/upMs/stopRate`) and the mid-fade comeback: less code (CLAUDE.md, "simple beats flashy").
Keep `holdMs` (a turn or a tap between two steps mustn't stop it); say in the PR if a lower one still holds between steps. The pogo
(`steps`) is untouched. Update the module's header comment, the decision note (a new one, about 5 lines) and `docs/areas/town-square.md`
if it describes the fades.
**Checks:** `packages/app/test/ride-sound.test.ts`'s fade tests become hard start/stop tests (each old → new in the PR body); typecheck;
the unit tests; `e2e/town.spec.ts`'s ride sound test if it checks a fade. Push; `.pr-body.md` (short) and `.done`. Commits end with
the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
