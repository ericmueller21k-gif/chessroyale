# Review: PR #707 (`claude/recluse-transform-book`, head 82d4b2e7), the Hidden Boss's transformation

Boss lane, one read-only pass. What I ran: the unit tests the PR touches (`recluse-online`, `recluse-cutscene`, `recluse-phase2`,
`recluse`: 52 passed), a dump of `PHASE_CHANGE` against the settings, and the phone `@perf` spec for phase 2
(`e2e/perf.spec.ts:319`) on this branch and on `origin/main`, the same machine, one after the other.

## Blockers

### B1. The phase change misses the phone frame budget: p95 100 ms, 36% of frames dropped (main: 16.8 ms, 3%)

`npx playwright test e2e/perf.spec.ts --grep "phase 2 on a slow phone" --project phone` (4x CPU slowdown, iPhone 13, DPR 3):

| | the phase change | four boards in play | result |
|---|---|---|---|
| `origin/main` | p95 16.8 ms, 3% dropped (61 of 2244), longest 317 ms | p95 16.8 ms, 1% | pass |
| this PR | **p95 100 ms, 36% dropped (267 of 752)**, longest 483 ms | p95 16.8 ms, 3% | **fail** (budget: p95 < 50, dropped < 15%) |

So the slowdown is in the transformation itself, not the four boards. CI leaves `@perf` out, so CI going green won't show it. The
lanes ask for a frame-rate check when the drawing or the frame loop changes, and this PR rewrites both.

Likely cause (`packages/app/src/components/RecluseTransform.tsx:295-306`): **two canvases the size of the screen at full
`devicePixelRatio`** (3 on the test phone: 1170×1992 ≈ 2.3 M pixels each, about 9 MB of backing store each). Both are cleared and
redrawn every frame for about 20 s, with `globalCompositeOperation = "lighter"` and several full-screen `fillRect`s (the dark at
:131, the white-out at :257). Both canvases are also composited over the whole page every frame, whatever is drawn on them.
Checked: with only that line changed to `const dpr = 1` (locally, not pushed), the same run gives the phase change **p95 50 ms,
15% dropped (197 of 1324)**, longest 200 ms. That's about half the cost gone, but still right on the budget and failing it. The
full-screen fills and compositing are the rest.

Fix, cheapest first (all three, since 1 alone measured 50 ms):
1. Back the light canvases at 1 device pixel per CSS pixel or less (`const dpr = Math.min(devicePixelRatio || 1, 1)`; even 0.5 is
   fine for light that's blurred and stretched anyway). The CSS size stays `W×H`, so nothing on screen moves.
2. Draw the full-screen dark (`drawBack`, :130) and the white-out (`drawFront`, :256) as one CSS layer each with an `opacity`
   (a `div` with a background), not as canvas fills: the compositor does those for nearly nothing.
3. Leave out the back canvas once it has nothing to draw. After `whiteFull`, `rays`, `shaft` and `grow` are 0, so all it draws is
   the pool for the slam's 900 ms. Mount it only while `t < T.whiteFull || (t >= T.crackAt && t < T.crackAt + 900)`.
Then run the `@perf` spec again and put the numbers in the PR.

## Majors

### M1. The FAQ still tells players he absorbs the God King

`packages/app/src/faq/content.ts:931`: "Beaten: his second phase follows … he absorbs the God King (gone for the rest of the fight),
then …". Since this PR the God King stays in his place, greyed, and can't be called. Players see this text, and it must match the
code. Suggested: "he transforms (the God King stays in his place, but can't be called for the rest of the fight), then …".

### M2. His first line is readable whole for 1.2 s, not the 4.1 s its pace gives it

`packages/app/src/recluse-phase2.ts:63` clips the first line's hold to `flipDownAt - 50 - line1At` = 5100 ms. That line ("Computation
without creativity is nothing. Now I have both.", 59 characters) takes 3655 ms to type, so after the 260 ms fade it is readable
whole for **1185 ms**. The chant's pace (Eric, Nov 13: the cutscene's pace, "err slow") gives 1700 + 40 × 60 = **4100 ms**. The unit
test only asks for 1000 ms (`packages/app/test/recluse-phase2.test.ts:94`), so it passes.

The music fixes the window (reveal at 10.3 s, the leap a second before the drop at 16.7 s), so the line can't start earlier. Options,
for the director (or Eric) to pick:
- (a) Keep the line up after the visor comes down: let it run through `flipDown` and the crouch, ending by `upAt` (16 735 ms). That
  gives 5835 ms, about 1.9 s readable. To fit the whole 4.1 s, it would also have to hold through the jump.
- (b) Flip the visor down later: `flipDownAt` 16 300 with the crouch at 16 535. That gives about 1.4 s, only a little better.
- (c) Type this line faster, e.g. `typeMs` 30 for it alone: 2790 ms to type, then about 2 s readable.

Whichever is picked, the test should ask for the readable time it means: either `readMs + perCharMs × length`, or the chosen
number. A bare 1000 ms passes almost anything.

### M3. Area page and comments still describe the absorption

The PR updates `docs/areas/bosses.md`, but not the God King's page:
- `docs/areas/god-king.md:86-92` ("The Hidden Boss absorbs him … `.gk-aura`, `.gk-unit.gk-drained`, `.gk-fading` … `king="gone"`")
  and `:148` (a test "absorbed: his look at each moment … gone for good" that no longer exists). This PR changes how the God King
  behaves in this fight, and CLAUDE.md asks for the area page in the same PR.
- Code comments that now say the wrong thing:
  - `packages/app/src/components/BossDock.tsx:98-100`: the `king` prop's doc still says "triumphant, drained, fading … or 'gone'".
    Only `"benched"` exists now.
  - `packages/app/src/godKing.ts:135` and `:155-156`: "his cry as the boss drains his power", "his triumph, then his cry".
  - `packages/app/src/components/BossEffect.tsx:176`: "the Hidden Boss's half-engine overlay follows his head".
  - `packages/app/src/characters/recluse.ts:1146` and `:1378`: "the half-engine look is an overlay … components/Recluse.tsx".

Fix: rewrite or delete each one. All are docs or comments, no logic.

## Minors

### m1. The suit's warm-up fills the wrong cache: his first phase-2 frames are drawn cold where he stands

`packages/app/src/components/Recluse.tsx:125` warms `frames(RECLUSE_BUST, ["idle2"]).map(suited)` and the same for `RECLUSE` through
`prewarmSprite`, which fills **BossEffect's** `frameImage` cache (`BossEffect.tsx:68`). But his place draws through
**BossCharacter's own** `frameImage`, which has its own `images` WeakMap (`BossCharacter.tsx:182-197`, the same code, a separate
map). So the suited `idle2` frames, and the suited ult frames (`spellbook2`, `spellLoop2`, `spellClose2`), are drawn for the first
time on screen as he lands home and at his first ult. That is the LESSONS.md "a stall the first time an effect shows" pattern. (Main
had the same mismatch for his old place anims; this PR carries it over to the suit.)

Fix: have BossCharacter use BossEffect's exported `frameImage`, which gives one cache. Then warm the suited `PHASE2_ULT_ANIMS` and
his results anims along with `idle2`.

### m2. A device that joins or reloads mid-transformation hears nothing until the drop

`packages/app/src/music.ts:78-81`: a device that is late for the intro (`t0 < now`) gets `late`, which plays the loop only, from
`dropAt`. So the split still lands on the drop, which is what item 1 asked for. But a phone that reloads 5 s in is silent for the
next 12 s while the light pulses on the slam and the build. The theme isn't decoded on that device yet either, so the 300 ms
`musicAtMs` lead doesn't help it. Fix: when `now` is between `t0` and `dropAt`, start the intro at an offset
(`AudioBufferSourceNode.start(when, now - t0)`) instead of dropping it. A follow-up is fine: this logic predates the PR, but the
intro is now 17 s of the scene.

### m3. A late device plays the reveal's spark when it joins, not at the reveal

`packages/app/src/screens/Recluse2.tsx:178`: `cue(t >= C.revealAt, "reveal", …)` fires as soon as the screen mounts if
`t >= revealAt`. A device arriving at 15 s hears the spark at 15 s. Gate it to its moment, e.g.
`t >= C.revealAt && t < C.revealAt + 500`. (`arcs` at :179 has the same pattern; it was there before.)

### m4. The phase-2 suit checks prove an attribute, not the picture

`e2e/recluse.spec.ts:681` and `:729` check that `[data-suit]` is visible. The old check placed the engine eye inside the figure's
box, on his head (removed at about :742 on main). `data-suit` is set from the same `suitOn` that picks the frame
(`BossCharacter.tsx:359-374`), so it is a fair proxy, and `recluse.test.ts:121` checks the suit parts on every frame. But nothing
checks that what's on the canvas is the suit. Optional: in the `?phase=2` test, read one pixel of the helmet from
`.boss-char-sprite` (`getImageData`) and compare it with the suit palette's helmet color.

### m5. `sceneStand` uses the cutscene's full timeline, not the one fitted to its window

`packages/app/src/screens/Recluse2.tsx:204-205` uses `recluseCutsceneTimeline()`, which is not fitted. With a shorter hold (the e2e
server's `CUTSCENE_HOLD_MS:12000`, `fitCutscene`), the man's and the child's `together` loop jumps phase at the handoff, so the
"no break" can't be seen in e2e. Production holds are full length, so this doesn't affect players. Fix: take `sceneStand` from
`recluseCutsceneFit(at - cutAt).timeline`, or pass the fitted `standAt` through the phase.

## Nits

- `RecluseTransform.tsx:31`: `openMs` is a `reduce` over the frames on every call (every frame). Hoist it into a lazy constant.
- `RecluseTransform.tsx:128` and `:197`: `lightNow(t)` runs twice a frame, once per canvas, and allocates its object both times.
  Compute it once in the layout effect and pass it in.
- `RecluseTransform.tsx:263`: `createRadialGradient` once per frame for 1.3 s (`downAt` to `revealAt`). Cheap, but a pre-made
  `L.glow` sprite stretched to `r` (as the other layers do) would allocate nothing.
- `docs/decisions/2026-11-14-recluse-transformation.md`: "Kept his older phase change's animations … for now". Worth a follow-up
  issue or a STATUS.md queue line so they don't stay forever (the kit's `reach`/`grab`/`snatch` cues and `recluse.ts`'s seize, rage,
  leap, drop and chant frames).
- `.go` and `.mockup` at the repo root are working files from the mockup rounds. Drop them before the merge, unless the pipeline
  wants them.

## What I checked and found right

1. **Online sync.** `PHASE_CHANGE.total` = 23 695 ms against `RECLUSE_ONLINE.changeMs` = 23 700 (guarded within 300 ms by
   `packages/app/test/recluse-online.test.ts:26`). `recluseCutsceneTimeline().endAt` = 107 480 = `RECLUSE_CUTSCENE.holdMs` (guarded
   by `recluse-cutscene.test.ts:16`). The server's `clocksAt` = `at + changeMs + countdown` (`packages/server/src/bosses/recluse.ts:203`;
   `packages/server/test/recluse-online.test.ts:287`). Solo and online both set `splitAt: at + PHASE_CHANGE.crackAt`
   (`solo.ts:1200`, `recluse-online.ts:130`) and `setSuitAt(at + whiteFull)` (`solo.ts:1198`, `recluse-online.ts:107`, in `begins`,
   which also runs for a device joining late). A device back during the cutscene gets `cutscene = {cutAt, until: at}`, and the scene
   now holds its last picture to `until` (`RecluseCutscene.tsx`, `on`), so the handoff has no gap. The crack lands at
   `musicAtMs + introMs` = 17 735 = the theme's `drop` mark (17.435 s) + 0.3 s; a late device's loop starts at `dropAt` (see m2).
2. **The absorption is gone everywhere it ran.** Nothing in `packages/` or `e2e/` references `absorbKing`, `AbsorbStream`,
   `absorbPaced`, `foeTriumph`, `foeDrained`, `seizeTalk`, the `revive` lines, `recluseDrain`, `setEngineAt`, `EngineOverlay` or
   `placeEngine`. The server, the protocol and the chess package are untouched. `KingShow` is just `"benched"`: a disabled
   `<button>`, its bubble hidden, through the phase change (`Recluse2.tsx:252`) and phase 2 (`:516`). Solo's `callKing` returns
   early under `kingHelpBlocked`. The only leftovers are docs and comments (M1, M3).
3. **The suit.** Where he stands it shows from `whiteFull` on, and only for kits with `suit` (only his). On the board he uses
   `RECLUSE_CHANGE`: normal clothes up to the white-out, `suitFrame` from `revealed` on, through `pickup` and `leap2`. On results,
   `suit.at` survives until `resetBeats`, so a phase-2 result wears it and a phase-1 result never does. The child and the cutscene
   never wear it. The header portrait keeps his face (the decision note records this call).
4. **No big board behind the four.** The stage only ever holds the four clipped quarter `Board`s (`Recluse2.tsx:225-229`), and
   `.board-wrap` / `.rc-stage` have no background, so the gaps open onto the page from the first frame they part. Nothing new
   mounts at the split.
5. **Tests.** No guard test listed in `docs/rules/eric.md` is touched (its only rules about him are his room and his lines; the
   room spec isn't in the diff). The rewritten checks are as strong as the old ones or stronger: the beats now sit within 400 ms of
   the music's marks, where before they only had to come in order. The exceptions are M2's 1000 ms floor and m4.
   Removed by the design: the `reviveLine`, the absorption beats, and the engine eye's on-head placement.
