# The reveal and phase 2's dock draw only what changed; a refused solo move keeps its timeout (Oct 16, 2026)

The follow-ups held back in "The boss screen draws only what changed" (DECISIONS.md, Oct 15): the reveal drew its whole
screen every frame, and the Hidden Boss's phase 2 drew its dock every frame. Same rule as then (Eric, Oct 14: "we want
easier code and less lag over all else, fewer bug risks"), same pattern, no new library. On the way, a latent bug in
solo's `score()`.

**What was drawn every frame.** Measured with #220's render counter (a diagnostic build, unminified, every component's
renders and their time) on a phone slowed 4x, main at 49028fc, three reveals of each solo match:
- Crowd's reveal (`CrowdReveal` in `Crowd.tsx`: Crowd, a raid's crowd, the Last Stand) keeps a frame clock for the
  ghosts, the vote bars and the God King's moments, and drew everything with it: the header, the scoreboard or chat,
  the boss by the board (twice on a phone), the dock, the poll and the board's clock. The poll and the dock work out
  every move's name (`toSan`, a chess.js position each) as they're drawn, so they were the screen's heaviest part.
- Classic's reveal (`RevealScreen`) ticks 20 times a second for its reel and drew everything with it, its list of picks
  and words under it included (`toSan` again).
- Phase 2's dock drew every frame so its clock and the boards' clocks ticked together.

**The fix.**
- Both reveals keep the header, the chat or scoreboard, the boss by the board and the board's clock as elements on
  `useStillKey` (the match changing, the boss's state changing, every 200 ms), as the boss screen does. The dock (raids)
  is memoized on the same key plus the clock-read values its words and the God King use (the move landed and played,
  the Last Stand's steps: the warning, the blow, the leap, his fall, whether he's away); the poll (Crowd) on the key, the
  move landing and the vote bars' count; Classic's picks and its words under them on the key and the move landing and
  playing. The position after the move is worked out once, when it plays, not every frame.
- Phase 2's dock is a memoized `SimulDock`, drawn again when its words change, with the still key, and when the whole
  seconds on your clock change, worked out from the same frame time as the boards' clocks (`moveLeft` and `clockLeft`
  give the same time left), so it ticks in the same frame as they do. Its "Back to my board" callback stays the same.
- Not changed: the board and what's drawn over it (the ghosts, the reel, the God King, the Last Stand), the eval bar,
  the phase change's dock (its words change with the clock).

**Renders** (diagnostic build, phone slowed 4x; renders a second, main → this branch; the screen's render work a frame,
inclusive ms, comparable between the builds only):

| Screen | its render work a frame, ms | header (Hud) | chat / scoreboard | boss figure (2 places) | dock | board's clock |
| --- | --- | --- | --- | --- | --- | --- |
| Crowd's reveal | 8.37 → 2.27 | 57 → 5 | 57 → 5 | – | – | 57 → 5 |
| A solo raid's reveal | 6.55 → 2.24 | 57 → 5 | 57 → 5 | 115 → 10 | 57 → 6 | – |
| The Last Stand | 4.51 → 1.72 | 56 → 5 | 56 → 5 | 112 → 10 | 56 → 6 | – |
| Classic's reveal | 6.21 → 1.99 | 20 → 5 | 20 → 5 | – | – | – |
| The Hidden Boss's phase 2 | 2.18 → 1.77 | 7 → 7 | – | 14 → 15 | 61 → 8 | – |

The board and the eval bar draw as before (57-58 a second in Crowd's reveal, 20 in Classic's).

**Frames** (the shipped, minified build, a phone slowed 4x, main and this branch served by turns on 8788; two pairs, the
order swapped in the second, each run started with the 1-minute load average under 2.5 on 4 cores, logged: 1.3 to 2.5).
Each cell: pair 1, pair 2.

| Reveal | frames over 20 ms, of all (main → branch) | p95 frame, ms | longest frame, ms |
| --- | --- | --- | --- |
| Crowd | 10/705, 32/674 → 6/703, 9/706 | 16.8, 16.8 → 16.8, 16.8 | 183, 250 → 233, 167 |
| A solo raid | 5/702, 9/703 → 8/698, 6/703 | 16.7, 16.8 → 16.8, 16.7 | 217, 183 → 183, 133 |
| The Last Stand | 10/662, 24/649 → 8/668, 20/654 | 16.8, 16.8 → 16.8, 16.8 | 150, 267 → 100, 117 |
| Classic | 37/1564, 32/1566 → 17/1576, 20/1581 | 16.8, 16.8 → 16.8, 16.8 | 250, 150 → 267, 150 |

`perf.spec.ts`, the Hidden Boss's phase 2 (the case this touches; pair 1 main first, pair 2 the branch first): the
phase change 35/903, 51/868 → 42/892, 49/888 frames over 20 ms (p95 16.8, 33.3 → 16.8, 33.3 ms: it doesn't draw the
dock any less), four boards in play 1/483, 6/480 → 0/484, 3/481 (p95 16.7 on both, longest 33, 50 → 17, 50 ms). All
passed on both builds.

What it says: main already held 16.8 ms at the 95th percentile through every reveal on the slowed phone, so the gain is
headroom, not a visible fix: the screen's own render work a frame is a third to a quarter of main's, and the frames over
20 ms are fewer or the same in every pair but the raid's first (5 → 8 of 700, within the noise). The longest frames are
single long tasks (a sound, an engine's answer) on both builds.

**Nothing stale.** #220's check (the page's clock paused and stepped 48 ms at a time; at each step the screen's markup,
then again after the match redraws everything at the same instant) through each reveal on both builds: Crowd (3 reveals,
243 steps), a raid (3, 243), the Last Stand (1, 233), Classic (3, 554), and phase 2 (the phase change and four boards,
494): main 0 differences; this branch 2. One is the scoreboard under the board (Classic, one step of 554; Crowd, one in
an earlier run) showing a new row up to 200 ms after the match's standings change between its own changes; it catches
up at the next still tick, as on your move's screen. The other is a speech box a letter apart at a typing boundary (a
raid, one step), the redraw's own noise #220 saw on both builds.

**Player-visible changes:** during a reveal, the scoreboard or chat under the board and the header can update up to 0.2 s
later than before when the standings change between the match's own updates (the chat's "Next in N s" ticks at most
0.2 s late), as they already do on your move's screen. Nothing else is meant to change.

**The solo `score()` fix.** `SoloMatch.score()` cleared the turn's timeout before its early returns, so a move it
refused (before the clock starts, not allowed this turn, or while the God King strikes) left the turn with no timeout:
it would never end on its own. The board never sends such a move today, so no player met it. The timeout is now cleared
only once the move is accepted. `packages/app/test/solo-score.test.ts`: a barred move sent in Boss alone changes
nothing, and the turn still ends on time (it fails on main).

**Testing.** Targeted lane (the reveal screens, phase 2's dock, solo's turn): typecheck; the whole unit suite (144
files, 1,804 tests); e2e `crowd`, `formats`, `solo`, `match-screen`, `sound`, `recluse`, `crowd-hidden`; `perf.spec.ts`'s
phase 2 case, two pairs as above.
