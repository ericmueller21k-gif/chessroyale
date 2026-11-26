# Review: `claude/chandy-mate-art` (Chandy's checkmate art wired), boss lane quick pass

Read: the PR body, `git diff origin/main...origin/claude/chandy-mate-art`, `MateOver`/`mateAim`/`mateAnims` (ChandyDodge.tsx),
`dodgeView`/`DodgeLayer`/`prewarmChandy` (Chandy.tsx), the new CSS, `chandy-mate.ts`'s exports, solo's `dodgeTurn` and net's dodge
run, the stills branch's phone GIF and computer leap still. Measured the aim for every king square and the prewarm's build costs
with tsx (numbers below). No blockers.

## Findings

### 1. should-fix: the bolt leaves his claws far off his reach for a king near the center or up the board
`packages/app/src/components/ChandyDodge.tsx:187-200` (`mateAim`), with `REACH_DIRS` (-30..60) in `characters/chandy-mate.ts:207`.

He stands with his feet on the board's center, and his reach only goes from 30° up to 60° down. The bolt runs straight from his
hand to the king. When the king is near the center or high on the screen, the bolt's angle doesn't match his arm. The angles below
are measured from the way he faces, for every king square with the crowd as White; the black side is the same in screen terms:
- **King on e5 or d5** (screen column 3 or 4, row 3): he picks `reach0` (level), and the bolt runs at **133°**, backward and down
  from his claws into his own body. His figure (z-index 2) also stands over those squares, so the bolt (z-index 1, under him) is
  mostly hidden. Only the crosshair and the dizzy hit show, on `.cd-lines` (z-index 3).
- **King on d6 or e6** (row 2): `reachU30`, and the bolt goes **-106°**, straight up through his head.
- **King on rank 8, files c to f** (row 0): `reachU30`, and the bolt goes **-71° to -93°**, 40 to 63° steeper than his arm.

How often: these come up when the crowd's king walks forward in an endgame. A mate with the winning side's king in the center or
far up the board is common (e.g. K+Q vs K with the crowd's king on e6). The step itself still works: the crosshair and the hit land
on the king. What breaks is the picture at the zap, the moment the whole opening builds to.

Cheap options (the director's call):
- (a) Pick the direction from the hand of the chosen reach, not from `at(30)` every time. This alone doesn't fix the cases above.
- (b) Add a steep up reach (-60 or -75) to `REACH_DIRS`.
- (c) Stand him a square or two off the center, away from the king's side, when the king is within about 1.5 squares of the center.
  He then never covers the king, and the bolt always runs forward.

### 2. nit: his checkmate figure's warm-up runs beside the other slices, and some anims are bigger than one slice
`packages/app/src/components/Chandy.tsx:491-493`.

`prewarmAnims(mate, …)` starts in the same callback as `prewarmSprite(CHANDY, …)` and each `prewarm(fx, …)`, so it runs alongside
them, not after them. Each prewarm is its own 4 ms slice per frame, so a frame can carry several. The 4 ms budget also can't split a
single anim. Measured in Node on this machine: 114 anims and 396 frames, 457 ms to build in total. The largest single anims took
30, 24, 23, 22 and 22 ms, and 19 of the 114 took over 8 ms. On a 4x-slowed phone that's about 100 ms hitches, spread over the
battle's first seconds.

This is not worse than what's already there. The pre-existing `staged.flatMap(([, a]) => a.frames)` in the same callback builds
all of CHANDY's staged anims in one synchronous go: 335 ms on the same machine, the bigger stall, and not this PR's. Optional fix:
chain the mate's warm-up onto the `done` of the CHANDY `prewarmSprite`, so only one slice is ever at work, as that function's
comment intends.

### 3. nit: no check guards "no double Chandy"
`e2e/chandy.spec.ts:73-77`.

The new sampler records the pose class at each step. It doesn't check that his spot's figure (`.boss-char-sprite`) is hidden while
`.cd-mate-fig` is up and visible again once it's gone (the scope-in, and after the win beat). The hiding is one CSS rule
(`.screen:has(.cd-mate-fig) .boss-char-sprite`). Adding `getComputedStyle(spot).visibility` to the same `at` string would guard it
for one line.

## Checked, fine
- **His figure leaving and coming back.** The spot hides only while `.cd-mate-fig` exists:
  - `jump` through `line`, then the win beat.
  - Not during `pause`: `mateAnims` returns null, so there's no figure.
  - From the scope-in to the end of the rounds (no MateOver), his spot shows again.
  - The meter's Dodge has no `d.mate`, so it never shows `mate` or `win`: no figure, nothing hidden.
  - A solo reload mid-opening resumes from the Dodge's own start, so `t >= 0` and there's no figure (`solo.ts` `dodgeTurn`, `kept`
    sets the time to 0).
  - An online rejoin mid-step shows the figure in that step's pose with no leap, and his spot hides at the same moment. One Chandy
    either way.
  - The run ends at `dodgeEndAt` = `win.end`, and with it the KO and the hiding.
  - A floor of several bosses doesn't apply: "a mate is a mate" there, so this view never shows with several bosses' sprites to
    hide.
- **A hidden page.** The leap's delay is measured once per step (`useMemo`) from `v.since`. CSS animations keep running on the
  document timeline, and the sprite reads `Date.now()`, so coming back mid-step or a step later shows the right frame.
- **Nothing else moves.** The figure and bolt are absolutely positioned inside `.cd-root`, with nothing in the layout flow. The
  board, the wrap and the row don't clip it (`.board-wrap` has no overflow, and `.board-row` is only `isolation: isolate`). The phone
  GIF shows the leap leaving the bar over its top with the bar and board unchanged. The computer still shows it coming in from the
  left with nothing shifted. The win's `.cd-root` z-index 8 sits under the banner (9) and the board's labels (9). Nothing else
  depends on its old 25, since it takes no taps.
- **Facing and mirroring.** The figure faces right as drawn. A king on the screen's left (`k[0] < 0`) mirrors the canvas about the
  feet (`transform-origin` at `--mf-fx`), and the hand's x is negated to match. `cell()` flips the board for the black crowd, so
  either color works in screen terms. "Degrees below level" and `atan2` with y down use the same sign.
- **The bolt ends on your king.** It starts at `hand` and runs `len = |to|` at `atan2(to)`, where `to = king's middle - hand`. That
  is exactly the king square's center, in board units of `--board-size`.
- **The leap's start.** `figurePoint` on the spot's canvas with CHANDY's foot is right for CHANDY_BAR too (same size and foot). The
  scale is the spot's pixels per art pixel over the board figure's. Transform origin at the feet.
- **`pointer-events`.** `.cd-root` is `none`, and `.cd-mate-fig` and `.cd-mate-bolt` inherit it. The canvas is `.fx-sprite`
  (`none`). Nothing new takes or blocks a tap.
- **The zap's hit.** It now waits for `ZAP_FIRE_MS`, which works because the Boss screen redraws every frame (`useFrameNow`).
- **Sounds.** Each run's tag carries its `since`, so a second battle's mate plays them again.
- **Changed tests only add checks.** `e2e/chandy.spec.ts` adds `figs` and two expectations, with nothing loosened or removed. The
  `characters.test.ts` describe is new on main (phase 1 never merged alone) and only adds.
