# Review: `claude/moo-cinematic` (Moo & Moon's Full Moon cinematic)

Boss lane's one quick review pass, read-only, Nov 17, 2026. Diff: `origin/main...origin/claude/moo-cinematic` (87aff8d).
Real bugs only, most severe first. Line numbers are on the branch head.

## What holds up

- **Solo and the server wait the same length, from the right instant.** `MOO_BEATS.fullMoon.total` (7080 ms) feeds `POWER_FX.fullMoon`,
  so `fullMoonMs` lengthens both `thinkMinAt` (`packages/server/src/lobby.ts:2309`, set in `requestBoss` in the same tick as the
  `thinking` broadcast) and solo's `minThink` (`packages/app/src/solo.ts:1045-1046`, and `alone` doesn't subtract time already
  spent, because `landed` is non-zero). On a normal turn his move is held to `at + 7080` (`playBoss` → `bossPlay`), and the crowd's clock only starts
  after his move and `bossTurnShowMs`, so no crowd clock runs under the cinematic. The 15 s `bossTimeout` is still well past 7 s.
- **The overlay can't get stuck.** It is portalled, returns `null` once `t >= B.total`, and unmounts with the moment (a new screen,
  his move, a victim screen). Both the phone's bar figure and the computer's side figure come back when `.power-moment.pm-fullmoon`
  goes. The `:has(.power-moment.pm-fullmoon)` rule has the same specificity as the `:not(.pm-stay)` override and comes later, so it wins.
- **Flurry, powered moves and daze still follow.** `prepareTurn` swaps the events as the crowd's turn begins, so the boss-move
  screen never carries `fullMoon` (no 7 s added to `bossTurnShowMs`). On the normal path the swap is noted at `at + 5440`, before
  his move. The e2e checks the order.
- **God King strike:** `callStrike` only acts in `play`, so it can't land during his thinking.
- **Art:** `prewarmCinematic` runs from `prewarmMoo` as the battle starts, and the earliest Full Moon is two moves in. If the sheet
  still isn't loaded, the field is just transparent over a visible board. That looks worse but breaks nothing.

## Findings

### 1. The match menu and its Resign/Leave confirm open hidden under the cinematic, and blind taps still reach them (medium-high)

`packages/app/src/styles.css:23131-23139` (`.mo-cine`: `z-index: 880; pointer-events: none`). The menu layer `.mm-scrim` is
`z-index: 65` (`styles.css:2160`) and sits in the middle of the screen, over the board, inside the covered area on both phone and computer.

- **Scenario:** a phone during the field or close-up (about 6 s). The player taps where the menu button is in the top bar. The tap goes
  through the field to the button, and the menu opens *under* the opaque field, so the player sees nothing happen. They tap again,
  or tap around, and those taps land on the hidden list (Resign / Leave) and then on its hidden confirm. They can resign or leave a
  boss raid without ever seeing the menu. This also breaks "nothing hidden": the menu is open but can't be seen.
- **Precedent:** the Hidden Boss's cutscene hit the same problem and raised the scrim above itself: `body.cs-on .mm-scrim { z-index: 901 }`
  (`styles.css:27087`).
- **Fix (pick one):** (a) mirror that rule: `body:has(.mo-cine) .mm-scrim { z-index: 881; }`, or toggle a body class from
  `MooCinematic` the way RecluseCutscene does `cs-on`. (b) Let `.mo-area` take taps (`pointer-events: auto`) while the field is up,
  so nothing under it is reachable. That also fixes #4, but it blocks the menu button for about 6 s.

### 2. A reload or late join mid-cinematic restarts it from zero, so his move cuts it off and he's drawn un-powered into the flurry (medium)

`packages/app/src/components/Moo.tsx:183-188` (`fullMoonMoment`: `at` is when *this device* first draws the thinking screen, kept
in a module map; then `noteSwap(boss, at + B.fullMoon.swapAt)`). The server's thinking message carries no start time
(`until: 0`), and a device back from a reload gets the stored `last` message (`lobby.ts:1112-1113`, `resendTo`).

- **Scenario:** an online raid. A player reloads, or a spectator joins, 5 s into the server's 7.08 s wait. Their cinematic starts from
  the hop at rejoin time. His move arrives about 2 s later, and the screen switches mid-close-up: the field vanishes on a hard cut.
  The swap was noted at `rejoin + 5440`, which is still about 3.4 s away, so `mooPowered` (`characters/moo-state.ts:33-36`) returns false.
  His first powered move, and the flurry's caster on that screen, draw him in his normal colors until then and go gold partway
  through the flurry. Before this PR the window was 480 ms; now it is 5.44 s. MooCinematic.tsx's header says "a screen
  drawn later carries on and everyone online sees the same", but that only holds within one page load.
- **Fix:** give the thinking message the server time it began. Add an optional boss field such as `thinkingAt: io.now()` in
  `requestBoss`, and convert it with net.ts's existing `offset` (`toLocal`). Solo can pass its own `Date.now()`.
  `fullMoonMoment` then uses that as `at` when it's present. The cheap alternative: if the moment is first seen with less than
  about 1 s left, or on a resent `last`, skip the cinematic, and `noteSwap` the swap as already past so he draws powered at once.

### 3. QUEEN SLAIN! plays under the field when the crowd's move that brings the Full Moon also took his queen (medium)

`packages/server/src/lobby.ts:2309-2310` and `packages/app/src/solo.ts:1045-1046`: `bossThinkMs(view, burnt, own)` takes the
**max** of the queen banner's time (`bossBannerMs() + 500`) and the 7080 ms, not the sum. The banner (`screens/Boss.tsx:572`) is a
`z-index: 9` layer inside the board, under the portalled `.mo-cine` at 880.

- **Scenario:** the Full Moon is due (warned last turn), and the crowd's move takes his queen. QUEEN SLAIN! (the God King's portrait,
  the haptic buzz) and the hop start together. From about 720 ms the field fades over the board and hides the banner for the rest
  of its run. The player feels the buzz but never reads the banner, and the God King's line bubble is hidden too.
- **Fix:** when `queenSlain`, start the cinematic after the banner: offset `at` in `fullMoonMoment` by `bossBannerMs() + 500`, and
  add that time to the think in both places, as an explicit sum for this pair, the same in solo and on the server. The simplest version is
  `own = fullMoonMs(b) + (queenSlain && fullMoonMs(b) ? bossBannerMs() + 500 : 0)`, with the same in solo.
  A one-line test in `moo-wired.test.ts` keeps solo and server agreeing.

### 4. The board stays live under the opaque field, so taps set or cancel premoves blind (low-medium)

`styles.css:23138` (`pointer-events: none` on `.mo-cine`). The boss screen's `<Board premove=…>` (`screens/Boss.tsx:558`) takes
premoves while he thinks.

- **Scenario:** a player taps the screen during the close-up, out of habit or impatience. Two taps on the hidden board make a
  premove they never saw, and it plays the instant their turn opens after the flurry. A premove they set before the Full Moon is
  also hidden for about 6 s, so they can't check or cancel it.
- **Fix:** `.mo-area { pointer-events: auto; }` while the field's opacity is above 0, so it swallows taps (see #1(b)). Or accept it
  and note the trade-off in the decision file.

### 5. In a wide window on the phone layout, he stands below the board, giant, and the close-up shows only a thin band (low)

`packages/app/src/components/MooCinematic.tsx:117-134`. The phone layout takes the whole `innerWidth`, and `k = max(w/200, h/260)`
covers the area. His feet land at `h/2 + 75k`, which is below the area's bottom whenever the area is wider than 4:3.

- **Scenario:** a laptop browser window under 600 px tall, so `onComputer()` is false (for example 1400×550), or a phone browser in landscape (the
  installed app is portrait-only). k ≈ 7: his feet sit about 260 px below the board's bottom, possibly off screen, his figure is 7×
  his art, and the close-up shows only the middle third of its height.
- **Fix:** clamp `stand.y` to `area.h` minus a margin, and cap the figure's scale (for example `min(k, area.h / 150)`). Or when
  `area.w / area.h > W / H`, center a fitted area of the art's proportions instead of covering.

### 6. The cinematic's tail can be cut on any device: no margin between its last frame and his move (low)

`at` is when this device first renders, but the move is timed from the server's (or solo's `set()`) instant. Solo: render delay Δ ≥ one
frame, so the cinematic's last Δ is cut. Online: the cut is however much sooner his move's message arrives than the thinking
message did. There are 420 ms of slack after he lands back (`hopBackMs` 720 against the landing at +300). Past that, a hiccup
of more than 420 ms on a phone's connection snaps him back mid-hop when his move lands. This rarely shows, but it gets worse with #2.
**Fix:** a 150–250 ms pad in `fullMoonMs` (the server's and solo's wait) beyond `B.total`. It costs no player time, since it falls
inside his thinking.

### 7. Where he hops from and the board's box are measured once, at mount (low)

`MooCinematic.tsx:105-108`: `spotBox()` and `boardOnScreen()` run once in a `[]` layout effect. If the board element is replaced
mid-cinematic (the screen re-mounts its board, or a phone rotates and changes layout), `useRect` keeps observing the detached node:
its rect becomes zeros, `area.h` becomes 0, and the field disappears while his figure is placed from stale numbers. A rotation also sends
the hop back to the old spot. **Fix:** read `boardOnScreen()` and `spotBox()` each render, or at the hop back, or pass the board in
from the screen the way RecluseCutscene's `board` prop allows.

## Test gaps (not bugs)

- No e2e covers the computer layout: `moo.spec.ts` skips it ("one run is enough: a phone"). Nothing checks the computer drawing: the
  area clipped to the board's column, the side figure hidden by the new `pm-fullmoon` rule and back afterwards, or the hop from
  beside the board. One still from `frames:moo` on a computer would cover it.
- None of #1 to #4 is guarded. If #2 gets the `thinkingAt` fix, a unit test of `fullMoonMoment` with an `at` from the past is cheap.
