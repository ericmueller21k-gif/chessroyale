# Quick review: the Stranger's polish (`claude/stranger-polish`, head 5c458d14)

Boss lane, one read-only pass against `notes/briefs/stranger-polish.md`. No code changed here.

## Blockers
None.

## Should-fix
1. **The unlock notice can say "now available" for a boss you already had** (`screens/TowerResult.tsx:63`, `unlocks.ts:79`).
   Both paths decide "new" by a "before" list that can be wrong:
   - Party floor: `before` is `unlockedNow()`, the module cache (`known`, `[]` until the picker has asked the server this session).
     Failing case: you unlocked him on your computer; on your phone (nothing in `brc.unlock.told`), with the picker never opened
     since the app loaded, your party wins floor 10 again: the notice shows, though he was unlocked days ago.
   - Solo floor: `before === null` (GET /api/tower answered with an error, e.g. offline for a moment) counts every boss as new
     (`!before?.includes(b)` is true). The same wrong notice, on a re-win of his floor.
   Suggested fix, one for both (and for 2): read the unlocks as the floor *starts* (the start's answer, or `refreshUnlocks()` in
   `askFloor` / the party floor's entry) and keep them with the floor; with no answer, show no notice rather than a wrong one.
2. **His floors' result now waits on an extra GET before it is sent** (`TowerResult.tsx:46-52`): `unlocksNow()` runs first, then
   `play.settle()`. `ask` never throws, so nothing is lost, but on a slow or dropped line it adds a round trip, plus `ask`'s 900 ms retry,
   before "Floor 10 cleared!" goes live (and a fetch that hangs holds the settle as long as it hangs). Reading at the floor's start
   (fix 1) removes it.

## Nits
- `Stranger.tsx:596`: the shade's watch is a `setInterval` while the ring is kept alive by the frame loop. With the tab hidden mid-storm
  the frame loop stops, the interval (throttled to 1 s) drops the shade, and coming back it fades in again over 1.2 s. Harmless; a
  `visibilitychange` check, or comparing against the loop's own last frame, would avoid the re-fade.
- `BossCharacter.tsx:297-302`: `keepStranger()` runs only on mount. If two of his figures were ever up at once and one unmounted, its
  `releaseStranger()` timer would let the sheets go under the other (they're fetched again, so a blink, not a blank). Not reachable
  today as far as I found (one Character per boss); worth a line in the comment.
- `tower-floor-scene.ts` now imports his battle character (`characters/stranger.ts`) into the town's floor scene; its idle frames
  stay in `figs` for the session. Small, and the page load back to the tower (#1028) clears it; just noting it for the memory budget.
- `e2e/stranger.spec.ts`: one check changed, for the PR body: `[ten.floor, ten.bosses, ten.best, ten.unlocked]` →
  `nine.next` `{ floor: 10, bosses: ["stranger"] }` (line 297) plus `[ten.best, ten.unlocked]` (line 376). The same facts are still covered.
  The scene's comment now says "its banner's 2.25 s before it". No check in `docs/rules/eric.md`'s guard list changed that I found.

## Checked
- **Knock-back drawn only.** `strangerBoard` (`Stranger.tsx:317`) hides the thrown squares from the *drawn* fen only
  (`withoutSquares`, never read by chess.js), from `nudgeAt` to `healAt + healMs` (9480 ms, before the scene's 10000 end); the scene
  draws the same set (`nudged(boss.board.fen)`, memoized by placement). The position, the move list and the server are untouched. A tap
  during the scene: the board's moves come from `moves` (`OwnBoard.tsx:209, 327` `destsFor`/`gestureMoves` against the real allowed
  list), so a hidden piece can't be picked and nothing illegal can be sent: harmless. Same mechanism main already used for the
  landing's nudge; the set just grew from c-f/3-6 to about the middle 5x5 (`THROW.reach` 36%).
- **The shade.** `pointer-events: none`, `aria-hidden`; one element on `body`, z 8; the board's row raised to z 9 only while
  `sg-shading` is on. It's kept only by the ring's frame draw, so it lifts within 400 ms + its ease once the ring stops: the battle ending
  mid-storm (`!boss.result` in the board hook drops the ring), resign (same), the screen closing (`releaseStranger` → `dropShade(true)`),
  and a reconnect (the ring re-mounts and keeps it, or doesn't and it lifts). Checked the pop-ups under the board (quick chat's `qpop`
  stays inside its tab; dialogs are 10+), so the raised row covers no tappable panel. His corner figure is inside the row, dimmed by
  `figLight` instead.
- **No ring before his leap.** `sceneOf` returns `ahead` until the moment's banner lead starts; the ring, rift and shade all wait on it
  (`storm = !ahead && ...`), and the shade only from `fireAt` in the scene. The spec's `early` check guards it.
- **Timing, server and solo.** `STORM_SCENE.ms` 11000 → 10000 and the storm's banner window `[0, 1500]` → `[0, 1]`. Both go through the
  shared `powerFxMs` (`boss-timing.ts:84`), used by the server's holds and solo alike, so the two match. The storm moment's total hold
  moves from 11750 to 12249 ms (with the default 750 ms banner extra): about **+0.5 s of display hold** as the storm begins. No rule
  timing moved: the storm's turns, its kinds, the meter and the finisher's hold (`STRANGER_FX` other fields) are unchanged.
  `POWER_FX.storm === STORM_SCENE.ms` still holds (chess test 394); the app's banner window matches (`Stranger.tsx:922`, `..., 1)`).
- **The entrance.** `ownEntrance` is only `["stranger"]` alone (his floors 10/30/50 when dealt alone; a mixed floor keeps the usual
  walk-in). Reduced motion (`still`) returns before it: no entrance. The floor's `go` timer is computed from it, so it can't stall the
  start; back from a match (times null) there's none. There is no skip on any floor's walk-in on main, so nothing to match there.
- **Unlock notice once.** `brc.unlock.told` written as it shows; a reload of the result re-reads the server first, which now has him, so
  no repeat; the spec checks it once with the blue `ff-window`. (See should-fix 1 for the wrong-"new" cases.)
- **Other bosses and screens.** `Results.tsx`: one line, mounted only for tower results. `Town.tsx`: one argument, `null` for every other
  floor; `floorTimes` with `own = null` gives the same times as before. `boss-timing.ts`: the storm's entry only. `BossCharacter.tsx`:
  the Stranger's branch only.
- **Memory.** His storm sheets now kept through a phase's redraw (`keepStranger` cancels the 3 s release) and let go 3 s after his
  battle's screen closes (closing ImageBitmaps). #1028's town release untouched (no change to the town's unload path).

## Not reached
- No local runs, frames or stills (read-only pass): the frame-by-frame fluidity, his size through the hop and the 45-55% dim were
  judged from the code and the spec's checks only, not watched.
- Whether `.screen.game` forms a stacking context on any layout that would trap the row's z 9 under the shade (the spec's move-list
  brightness check covers the phone layout; the computer layout not looked at).
- The CI result of the head commit.
