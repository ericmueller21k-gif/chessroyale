# The Hidden Boss's transformation, redone: the book's light, no God King (MOCKUP, Nov 14)

Eric's ask: after the cutscene, no glitch back to his place and no stealing the King's power. The book on the floor in front of him
opens and light pours out of it (the same light as the summoning in his room), it beams up into him, and that's what transforms
him. It's one smooth transition, still in the zoomed-in lens with the child beside him. Once he's the cyborg, the lens lifts and
he jumps and splits the board where he stands. The God King is left out of it.

- `phone-transform.gif` / `computer-transform.gif`: from the cutscene's last line to "PHASE 2" (12.5 frames a second; the MP4s are 25).
- Stills `phone-N-*.png` / `computer-N-*.png`: one per beat, numbered as in the table.
- Made from a real fight mid-game by `scripts/preview-recluse-transform.mjs` over the dev lab `packages/app/src/dev/recluse-transform-lab.tsx`
  (on `claude/recluse-transform-book`; nothing in the app imports it). No game code was changed.

## Beat by beat (s from T0, when the book starts to open; T0 is also when `recluse-phase3`'s intro starts)

| s | What happens | The music (`recluse-phase3` marks) | Still |
|---|---|---|---|
| −8.8 | The cutscene's last line ("I'm not sure. The only one who can prove it is right next to me.") | his beaten theme | 1 |
| 0.0 | 0.4 s after that box is gone, the book flat on the board in front of him lifts its cover and falls open (1.1 s). Its pages light up and motes rise. He looks down at it | the intro starts (the beaten theme fades out under it) | 2 |
| 2.64 | The light bursts out with the summoning's look: rays shoot up and outward, rays run across the board, and a pool of gold spreads. His head snaps back, eyes wide | **slam** 2.64 | 3 |
| 3.04 | A shaft of light climbs from the book up through him and lifts him off his knees (1.9 s) | **build** 3.04 | |
| 3.34 | His first line in a cutscene box: "Computation without creativity is nothing. / Now I have both." (typed by 7.0) | | 4 |
| 4.94 | His arms go up and his hair lifts into phase 2's (his own `chantRaise`, then the `chant` loop), and he sways in the beam | | 4 |
| 7.60 | A white flare runs up the beam, his engine eye and circuit lines ignite, and he's the cyborg. Over 0.9 s the rays draw back into the book, which keeps glowing | | 5, 6 |
| 11.3 | The lens lifts (0.7 s) and the child fades (his own fade frames, 1.4 s) | | 7 |
| 12.8 | His second line, in his usual bubble (the lens is gone): "Prepare yourself. / This is the ultimate test of your skill." (typed by 16.4, a second before the drop, as today) | | 8 |
| 16.24 | He crouches over the book | | |
| 16.435 | He leaps high, straight up, and hangs for a second. The open book stays glowing on the board | **breath** 16.435 (the silence) | 8 |
| **17.435** | **He lands back over the book on the drop.** A flash of light, and the board cracks under him. His arms fly up and the blue arcs strike from his hands | **drop** 17.435 (the loop starts) | 9 |
| 18.2–19.5 | From here it's today's sequence with today's gaps after the crack: the quarters part (+0.75) and grow into four boards (+1.15, 0.9 s), the light dies out | | 10 |
| 19.6–21.1 | The book snaps shut and flies into his hands (`pickup`), the pieces fly to their Chess960 squares, and he leaps back to his place (`leap2`) | | |
| 21.2 | "PHASE 2" (2.15 s), then the 5-4-3-2-1 countdown and the clocks start, as today | | 11 |

So the split still lands on the music's drop: the intro is 17.435 s, and the music's breath is 1 s before the drop, so the leap's
1 s of hang time fills that silence and he lands on the drop. The whole thing runs 23.4 s from the book to the end of "PHASE 2",
against about 35 s today from the end of the cutscene (the God King's absorption, his rage, the leap in, the book throw and the
cast are all gone).

## Calls I made (Eric can say otherwise)

- **Where he jumps:** he jumps straight up and lands back where he knelt in the light: 42.5% across the board and 66% down, a
  little left of the middle. That's the spot the cutscene put him in. The crack still runs down the board's middle. He keeps the
  book at his feet the whole way, so it never jumps or pops.
- **His two chant lines stay** (Eric's, Nov 13). The first is in a cutscene box while the lens is up. The second is in his usual
  bubble once the lens is gone, still typed out a second before the drop.
- **The light** is the summoning's own sprites and beats (`town/shops/recluse-scene.ts`) drawn flat on the board. In the real
  build I'd export them from one shared module rather than copy them. Inside the lens the room darkens a little as the light comes on.
- **His frames:** all are existing art (kneeling, rise stances, `chantRaise`, `chant`, `pickup`, `leap2`). There is one new
  short set: the book opening on the floor (its `half` and `read` parts), the lift off his knees, and the jump with the book
  left lying open.
- **What this mockup doesn't show:** the screen behind is phase 1's fight mid-game, so the dock still says "Your move." and the
  clock runs. In the game it's the phase change's screen. The "PHASE 2" banner is CSS-animated and doesn't show up on a paused
  clock (it's unchanged). On a computer his second line sits in his bubble by his empty place at the board's bottom left.

## On "go": what changes in the game

The God King's absorption is removed: `absorbKing`, `AbsorbStream`, the seize/seizeLoop/seized/rage beats in `PHASE_CHANGE`,
`king` in the dock (he stays in his place, alive and unused), his triumph and drain lines, and his sounds there. The cutscene's
ending (the child's fade, the hold, the lens lifting) becomes this sequence. `PHASE_CHANGE` is re-timed so the crack is the
intro's drop, the boss kit stays green, and so does the split-on-the-drop test. The server's phase-change length
(`RECLUSE_ONLINE.changeMs`) follows the new total, and I'll list any protocol pieces in the PR.
