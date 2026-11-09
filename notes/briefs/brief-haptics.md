# Haptics: a tick when you tap a piece and when you move; a few boss moments (Eric, Nov 9)

Eric: "when you tap [a piece] … it should vibrate. And then when we drop it on a square … vibrate on that square … if you just hold
down on a piece, then no vibrate. … for phone, like when Big Boy bounces, it could do like 3 vibrates, or when Babur's balloon pops,
a quick one … it doesn't need to be for every boss, just where it makes sense … I could test them to see how it feels."

## The one module
`packages/app/src/haptics.ts`: `haptic(kind)` with named kinds (`select`, `move`, `bigboyBounce`, …) and their patterns in
packages/core/src/settings.ts (`HAPTICS`). Two ways, picked at runtime:
- **Android and others:** `navigator.vibrate(pattern)`.
- **iPhone (iOS 18+ Safari has no Vibration API):** the known trick: a hidden `<input type="checkbox" switch>` with a `<label>`; a
  `label.click()` toggles it and iOS plays its system haptic tick. It works only inside a user gesture (a touch handler), so on iPhone
  the piece taps and moves tick; events that happen by themselves (a boss power on the opponent's turn) likely can't, and that's
  fine: call `haptic()` anyway (no error; nothing happens). A pattern on iPhone = one tick per pulse within the gesture (cap 3).
- The existing two calls (DuelQueueBar's match-found buzz, Crates' 15 ms) move onto the module.
- **Settings → a "Vibration" switch** (on by default; where the device can't vibrate at all, shown greyed with "Not available on this
  device": nothing hidden). Respect it everywhere. Never vibrate under the test switches' screenshots (no effect anyway).

## The board (components and src/board/)
- **Tap a piece to select it** (a tap, not the start of a press-and-hold drag): `select` (one short tick, ~10 ms).
- **A move made** (tap the destination, or let go of a dragged piece on its square): `move` (one short tick, ~15 ms). Only your
  own moves (the crowd's pick/vote too), never the opponent's or a replay.
- **Pressing and holding to drag: no tick** at the start. A drag that ends back on its own square or off the board: no tick.
- Every board that uses the shared board component (solo, 1 v 1, crowd, squads, boss battles). Keep it to these two; don't add
  ticks for menus.

## A few boss moments (first set; Eric tests how they feel)
Pick the moments in docs/areas/bosses.md that fit (Eric's two first), wired from the events the screen already plays sounds or
animations for (the same once-only cue, so each fires once, and only on the device that sees it):
- **Big Boy's block lands / his bounce:** three short pulses (e.g. [30, 60, 30, 60, 30]).
- **Babur's balloon pops:** one quick pulse (~25 ms).
- 2-4 more where it's natural, e.g. Ginger's freeze landing on a piece (a short double), Boingo's pie splat (one firm ~40 ms), a boss's
  strike taking your piece (one heavy ~60 ms), QUEEN SLAIN (a double). Name each in the decision note with its pattern so Eric can say
  which to keep. All patterns in `HAPTICS`.

Lane: targeted (shared board component + boss screens). Effort high. Tests: unit tests for the module (the setting off: nothing; the
picking of the way; patterns from settings), and one focused e2e check (a stub `navigator.vibrate` records calls: tap-select → one
`select`, a tap-move → one `move`, a drag that's held then dropped → only `move`; the switch off → none). Don't run sims. Decision note
docs/decisions/2026-11-09-haptics.md; update docs/areas/board.md (and bosses.md for the moments). FAQ: a line under Settings if the FAQ
lists settings. No stills needed beyond the Settings switch (390 light).
