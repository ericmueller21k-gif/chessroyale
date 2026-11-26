# Review: PR #986, Dash's "Hang on" round 2 (head fc66ac7)

Boss lane's quick review pass, read-only. Two should-fix findings, three nits. Timing, the portal's teardown and the rest of Dash's
kit are sound.

## Should-fix

1. **`packages/app/src/characters/dash-figure.ts:197`: the cheetah frames are drawn ~272 times, not twice.** `hangOn` copies every
   frame (`{ ...f }`) so it can tag it in `HANG_SECTION`, but `frameImage`'s cache (`BossEffect.tsx:68`) is a WeakMap keyed by the
   Frame object. Measured: `hangOn` has 330 frames and 330 distinct objects; `hangFast` alone has 3. So at cheetah speed, every
   22 ms frame on screen is a fresh `renderFrame` (about 2,200 specks each, 1.35 ms on this container's CPU, likely 4 to 7 ms on a mid
   phone) plus a new 43 KB `ImageData`. That is about 12 MB kept for good, because the lazy anim holds its frames. Failing case: a
   phone at cheetah speed spends a third of its frame budget redrawing pictures it already has, and `hangFast`'s comment ("two
   drawings, drawn once each") is false. Fix: don't copy. Tag the original frames (each belongs to one section, and upF/downF appear
   only in `hangFast`), or keep the sections as index ranges.
2. **`packages/app/src/components/Dash.tsx:186` with `DashStall.tsx:228`: his clock tap removes `dash-away` in the middle of the gag.**
   Both toggle the same body class, and DashTap's cleanup removes it unconditionally. DashTap sits beside the screens
   (`App.tsx:2782`), so its figure gets up *after* your move. `stallPlan` doesn't rule out the pop-off turn either, since the pop-off
   is state, not an event. Failing case: on the "Hang on" turn (crowd turn 14 to 20) the tap hasn't come yet, and you think for 10 s
   or more. He lies down, you move, the gag starts. 430 ms later (or about 2.3 s on the "just a joke" path) DashTap's `shown` turns
   false and its effect removes `dash-away`. For the remaining ~13 to 15 s his spot's figure shows *and* his routine plays on the
   board: two Dashes, plus two `dash-say` bubbles during the overlap. Fix: count the holders (add/remove by a counter or a data
   attribute per holder), or have DashTap leave the class alone while `hangOnAt` is live. The e2e never plays a tap on the gag's turn.

## Nits

3. `Dash.tsx:194-214`: the figure is placed once, on `[at]`. Rotating the phone or resizing the window mid-gag (up to 15.6 s) leaves
   him off the board's middle, maybe off the screen. A `resize` listener that redoes the placement would cover it.
4. `e2e/dash.spec.ts:582`: `expect(DASH_HANG_ON.hitMs).toBeLessThan(...)` only compares settings. It is the unit test's check
   (`packages/chess/test/dash-clock.test.ts`) again and proves nothing in the browser; drop it, or count the click gap seen.
5. `packages/app/test/dash-clock.test.ts:139`: the title says "the Rush's", but no Rush animation is in the list (`fit3/4/5/10`,
   `slam`, `clockSlap`, `move`). Fix the title or add the Rush's run.

## Checked, no finding

- Timing: `popOffMs` (15.9 s), `hangOnAt`'s window and the `hangOn` run (unit-tested equal to `total`) all come from `DASH_HANG_ON`.
  The online margin (300 ms) and a reconnect restarting the on-screen clock are unchanged from round 1.
- The portal unmounts as thinking ends, at `total`, on leaving or at match end (class removed; finding 2 aside). Late mounts get negative
  delays. Whole at 320 px. No taps taken (`pointer-events: none`); premoves are held. The rest of Dash is unchanged (`bigClick` only
  exported). Per frame: one `putImageData`, three data attributes, no layout reads; jump and zip are WAAPI transforms.
