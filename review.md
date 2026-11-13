# Delta review: PR #684 (the child form online), review round

Independent, read-only. Scope: `git diff 614d07f9 2f5d81de -- packages e2e docs` (the fixes for `origin/review/child-online:review.md`),
plus a check that the branch tip (`e889c627`, main's cutscene merged after the round) didn't undo them. Brief: `notes/briefs/review-684-delta.md`.

**Verdict: no findings.** Every finding from the first review is fixed as the PR body's "Review round" says. Nothing I checked broke.

## Runs (at the branch tip, `e889c627`)

- `npx vitest run packages/app packages/server packages/chess`: **327 files passed (1 skipped), 4903 tests passed (2 skipped).**
- `npm run typecheck` (all six packages): **passed.**
- **Mutation checks** (scratch, reverted, nothing pushed):
  - `clearPremoves(this)` removed from `NetMatch.setBoss`: the three new `recluse-online.test.ts` cases (intro, `round`, reveal) fail.
  - `clearPremoves(this)` removed from solo's `nextForm`: the new `engine-move.test.ts` case fails.
  - The `!this.r.bossLoaders` guard reverted in `lobby.ts`: the new n1 test fails ("expected 1 to be 0").
  - So each fix has a test that would catch it being lost.
- e2e: not run (outside the brief). At the time of writing, PR #684's e2e run (`43491288527`, 15 shards) was still in progress. See note 1.

## Each finding

- **m1, `setBoss` on every path:** fixed.
  - All five places that take the battle from the server go through `setBoss`: `round` (`net.ts:709`), `boss` (`:834`), `lights`
    (`:870`), `phase2` (`:914`) and `onReveal` (`:974`).
  - The only other assignment is the local charge spend (`:1475`), which keeps the same form. It's correct that it skips `setBoss`.
  - The reset (`winFormSent`, the King's speech, `bossVoice`, beats, banners, premoves) runs when `this.boss.form !== next.form`.
    That's once per form change, whichever message brings the man first. A fresh `NetMatch` (`this.boss` null) skips it, as designed.
  - The cutscene merge's new `phase2` code (the reload during his hold) reads `this.boss` after `setBoss` and is unaffected.
- **m2, premoves cleared once per form change:** fixed.
  - `clearPremoves(game)` (`board/yours.ts`) empties only that game's queues (prefix `gameKey(game):`) and keeps marks.
  - It's called inside the form-change branch, so it never runs on an ordinary message. The test checks that another of the
    child's `round`s keeps the 🏆 armed, so nothing reset.
  - Solo's `nextForm` clears too.
- **`clearPremoves` telling the server:** it goes through `put`, which notifies the `onYours` listeners. `NetMatch.tellPremove` then
  sends `{t:"premove", move:null}` when the head changes.
  - If the socket is down at that moment, the null is lost, and the reconnect re-sends only a non-null `premoveTold`. So the server
    can keep a stale "told ahead" premove.
  - That's harmless. The server credits a premove only when the pick itself carries `premove: true` (`lobby.ts:2904`), and a move
    played by hand doesn't.
  - Premoves are played by the client, never by the server, so a device away through the change can't have one played for it.
- **m3, the Crowd final through the child:** fixed.
  - `crowd-hidden-boss.test.ts` has the scratch test, and more. It checks each of the child's requests at `childRating(ply)` /
    `levelForMaia`, the man's at `fixedLevel()` / Maia's top from move 1, phase 2, and results with 100 placements.
  - The dead e2e's desktop skip is removed. Its `@phone-only` tag keeps it on the phone project, so it now runs for the first time.
- **m4, the FAQ and the Crowd's area page:** fixed.
  - The FAQ also fixes the God King's section (twice) and the brain block, and `faq.test.ts` pins the new lines.
  - `docs/areas/crowd.md` now describes the child first, and lists the new tests.
- **m5, stale comments:** fixed (`runner.ts` `firstForm`, `settings.ts` `RECLUSE_CHILD`).
- **n1, more devices told to load Maia:** fixed. `moreLoaders` runs at an intro only while `r.bossLoaders` is unset.
  - If the child's brain was Stockfish, `moreLoaders` returns before setting it, so the man's intro still tells devices then.
  - If the child's pool was empty, the man's intro tells none, and later moves top up through `checkBoss`.
  - `bossLoaders` is never cleared, but a lobby holds one boss battle, so that's fine.
- **The chess Crowd tests' intent:** kept.
  - "Crowd's boss final" now checks the child first (form, no powers). It then beats him (`bossForceWin`) and checks `nextBossForm()`
    from `START_FEN`. Finally it checks the man's fixed elo, brain plan and powers on `runner.boss` / `bossView()`, not on the stale
    child reference.
  - "50 v 50 boss final" is pinned to the man (`recluseChild: false`). Its subject is the God King never helping, which is true of
    the man only.

## Notes (no action needed from the author)

1. **The online Crowd e2e (`crowd-hidden.spec.ts`, "online: a Crowd boss final meets him…") has never run before this PR.** It has a
   16-minute timeout. Read its result in PR #684's e2e run before merging. If it's red, the cause may predate this PR, since the test
   never ran. On main it now lands on a phone shard every run.
2. The new solo premove test sits in `engine-move.test.ts` under "Win this form: who sees it". That works, but it's a slightly odd home.
