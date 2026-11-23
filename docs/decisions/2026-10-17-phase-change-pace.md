# The Hidden Boss's phase change, about 10 s slower, and a countdown before phase 2 (Oct 17, 2026)

Eric, Oct 17, after playing it: "The animations are all, everything's perfect, but it happens way too fast." From the
mate to the split he asked for about 10 s more, spread over a few spots, the animations themselves unchanged: more
talking after the mate (4 to 5 s), a slower or held absorb, his cast on the board 3 to 5 s longer; and when the boards
split, "imagine you're a player and you've never seen that before … you're going to be so confused what's going on":
a big 5, 4, 3, 2, 1 on all the boards before phase 2's clocks run. Lane: `god-king` (the boss battle's presentation),
with `characters` (his lines). Area pages: [bosses.md](../areas/bosses.md), [god-king.md](../areas/god-king.md).

## What changed

Every added time is a setting, `RECLUSE_PHASE2.change` in `packages/core/src/settings.ts`; `PHASE_CHANGE` in
`packages/app/src/recluse-phase2.ts` builds the timeline from them.

| Beat (s after the mate, a phone, first frame on screen) | Before | After |
| --- | --- | --- |
| He falls (the board holds), his mumbling from 1.2 s | 0.5 | 0.5 |
| The phase change: the God King gloats over him | 1.9 | 1.9 |
| His new line: he'll take the God King's power | (none) | 6.6 |
| He seizes the power (his hand up) | 3.6 | 8.1 |
| The power lands (his engine eye lights) | 6.2 | 10.7 |
| His line as it lands (time on screen) | 6.4 (3.4 s, cut by the chant) | 10.8 (4.5 s, whole) |
| His fist held (`seized`) | 0.6 s | 2.1 s |
| Up in a rage | 6.8 | 12.8 |
| The leap onto the board | 7.7 | 13.7 |
| The cast (the chant over the open book) | 9.8 | 15.8 |
| The cast's length, to the crack | 1.7 s | 5.7 s |
| The board cracks | 11.5 | 21.5 |
| The boards split | 12.3 | 22.3 |
| "PHASE 2" | 15.4 | 25.4 |
| 5, 4, 3, 2, 1 on every board | (none) | 26.8 to 31.7 |
| The clocks run | 16.8 | 31.8 |
| Your first move (the test switch's Qxf7) | 17.4 | 32.4 |

(`?win=1` on an emulated iPhone 13, each beat's first frame watched every animation frame; both runs set to the same
mate-to-phase-change time, 1.9 s, since the engine's reply to the mate varies by up to a second.)

- **His words before the seize** (`talkMs`, 4.5 s): the seize comes 4.5 s later. His fall's mumbling (his existing
  line, "No... the book said... bishop takes... no...") plays out whole, then, as it ends (`talkAt`, worked out from
  his collapse and that line's time), a new line about taking the God King's power (`RECLUSE_LINES.seizeTalk`, one a
  phase change), typed out before his hand goes up; then he seizes it. Meanwhile the God King's gloat has its whole
  time (before, his cry cut it after 2 s).
- **The absorb** (`absorbHoldMs`, 1.5 s): the drain itself is the God King's Last Stand frames timed to his stagger, so
  stretching it would have shown other frames of his; instead the moment after it lands is held: the boss's fist stays
  closed (the last frame of `seized`: a one-shot given a time in a figure run now holds its last frame), his engine eye
  newly lit, the God King fading, and the dock says "The God King's power is his!" (the message Eric offered as an
  option). His line as it lands ("Mind and machine. Both mine now.") is now critical, so it comes as the power lands,
  cutting in on his line before the seize (read for 2.9 s by then).
- **The cast** (`castHoldMs`, 4 s): the chant loops on over the open book, the light pouring up, 5.7 s before the
  board cracks instead of 1.7 s. With the room, his chant line waits for his absorb line to end (a second at most)
  instead of cutting it off.
- **The countdown** (`countdownSeconds`, 5): the round's own `CenterCount` (the big number that pops, the tick a
  second), 5 to 1, on every board (a phone's big board and its three small ones; a computer's four), "Get ready" over
  yours, the dock saying "2:00 on your clock" "No added time." as "PHASE 2" did. No clock runs and no move can be made
  until it's over; his phase 2 line comes as the clocks start.

## Calls I made

- **The countdown comes after "PHASE 2", on phase 2's own screen**, not during the split: while the boards split the
  pieces are still flying to their Chess960 squares, and on a phone the four quarters aren't where you play (a big
  board and three small ones). So the split, the shuffle and the banner play as before, then phase 2's screen shows the
  boards still, where they'll be played, with the count over them. "Get ready" is the round countdown's banner,
  reused; the other boards show the number alone.
- **One new line, not two**: the 4.5 s after his mumbling hold one line typed and read before the seize; a second
  would have pushed the seize past the budget or cut the first short. Each of the two drafts ends on taking the power.
- **The hold is after the absorb lands, not a slower drain**: see above (no art changes).
- **His word before the seize is not about what he says as it lands**: "Give me that power!" before, "Mind and
  machine. Both mine now." after, so they don't repeat.
- **Reduced motion**: the same times (the timeline is the same code); the countdown's numbers don't pop (no animation),
  each shows for its second. Nothing else added moves.
- **No resign during the countdown**, as during the phase change: your board isn't in play yet.

## New lines for Eric (drafts, one edit each in `packages/app/src/characters/recluse-lines.ts`, `seizeTalk`)

- "An engine in a golden crown... Give me that power!"
- "So he's your engine. I'll take his power myself."

## Tests

- Unit (`packages/app/test/recluse-phase2.test.ts`): the phase change 25 to 30 s with its fall (was 15 to 20); the
  added times are the settings and where each lands; the new line after the mumbling, typed before the seize, read
  2.5 s before the absorb line; the absorb line whole up to the chant, the chant's line within about a second; the God
  King's gloat whole before his cry; the countdown in solo: nothing starts and no move is taken until it's over, then
  the clocks. The FAQ says the countdown (from the setting).
- e2e (`e2e/recluse.spec.ts`, both projects): every beat's first frame watched (`watchSpans`): the gloat, his new line
  (up through the seize), the seize at least `talkMs` after the gloat, the fist held at least `absorbHoldMs`, the cast
  at least `castHoldMs` before the crack, "PHASE 2", then 5, 4, 3, 2, 1 a second apart on four boards, no clock running
  (the dock's or any board's) until a second after the 1; the countdown's numbers still under reduced motion. Its
  waits, and `crowd-hidden.spec.ts`'s and the phase 2 perf spec's, now come from the settings.
