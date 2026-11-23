# Resume sometimes starts nothing and the card comes back (Nov 23). Opus, high (a UI race; no stored-data change expected)

Main's full run on `9e0dce2` (run 45088115360, shard 11) was red. `[phone] e2e/xp.spec.ts:382`, #885's Resume test, failed once and
passed on its retry. Its error: after `card.getByRole("button", { name: "Resume" }).click()` and `expect(card).toHaveCount(0)` (the
card did close), `yourTurn()` waited 60 s with `window.match?.phase?.kind` undefined: no match ever started.

The failure's page snapshot is `notes/ref/resume-race-snapshot-2026-11-23.md` on `claude/director-notes`. Home is up, and the card
"You have a game in progress / Ginger · Move 12 / Forfeiting counts as a loss." is **on screen again**, Resume focused, with **no error
line** (so not KEPT_ENDED, "Couldn't resume", paused, or "Played in another tab": each of those sets home's error line).

The card closed, then came back, with no match. Find the path at its cause. Read `App.tsx` `resumeKept` (~1497: `offerKeptSolo(null)`,
then `if (match) return;` silently, `takeKeptSolo`, the awaits on `keptSoloOpen`/`enginePool`/`solo.preload`/`game.preload`), every
caller of `offerKeptSolo`/`reofferKeptSolo`/`keptOnLoad` (the load's account load, Boss Battle opening, the `storage` listener), and the
effect that clears the card while a match is on. Suspects:
- (a) The reload's account load finishing after the tap and offering the card again.
- (b) A silent return (`if (match) return;` with a stale `match`, or one of the awaits never settling).
- (c) Two `resumeKept` calls racing.

Reproduce it: tap Resume the moment the card shows after a reload, with the account load slowed (route `/api/me` with a delay), in a
unit test or the e2e. A tap must either start the game or say why, never close the card silently, and never bring it back over a game
that's starting.

Fix it in the app. Then make the e2e test tap the way a fast player would (no waiting for the account to load), so it covers this
race on every run.

Read CLAUDE.md ("Fix the cause"), `.claude/LESSONS.md` ("keep before show"), `docs/decisions/2026-11-22-solo-resume.md`.
Lane: targeted, plus the area's specs (`xp.spec.ts`, `battle-tower.spec.ts` on phone, locally under the e2e lock).
Branch `claude/resume-race` from `origin/main`. Write `.pr-body.md` (what changed, what players see, changed checks old → new) and
`.done`, push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only.
