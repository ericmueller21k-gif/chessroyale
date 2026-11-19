# Battle Tower PR 11b: the clerk, the elevator and the floor room ARE the tower (no separate screen) (Nov 19). Opus, high. Targeted lane

**Eric, Nov 19 (his words, the brief's whole point):** "you walk into the battle tower, you talk to the clerk, you start a match. After
the round ends, it's like a victory or defeat screen, like it normally is. And then it takes you back. And then you stand there and
wait in the room. And then the next, you go up whatever the elevator, you go to the next floor and then you continue on." He never
asked for the menu-style tower screen (`/tower`: run card, bests, Solo | Party, Start a new run) that PR 10 built from the design's old
home-card section: **remove it** (the route, `screens/Tower.tsx`, its CSS and its tests' use of it). Keep everything else PR 10 built
(the battle with several bosses, the split bar, the strip, no Last Stand, the restore, the server calls) and PR 11's building and lobby.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/battle-tower.md`, `docs/areas/town-square.md`, the design §4
(the room), and the floor room's art on `claude/boss-art` (`scripts/boss-art/out/house-shop-tower-floor`; README on
`stills/battle-tower-building`: floor tiles never `flip`). Branch `claude/tower-flow` from main.
**The flow (build exactly this; reuse the challenge room's walking, marks, seating and its zoom into the board):**
1. Lobby: Talk to the clerk → his card offers **Start** (no run, or after a run ended) or **Continue: floor N** with a small
   **Start over** under it (a saved run: it asks "Start over from floor 1?" first). Nothing else. Your bests go on the lobby's
   "Best floors" board (solo; drawn on the board, no new screen).
2. You walk into the elevator → **the floor room** with N on its walls; you walk to your mark; the floor's bosses come out of the
   elevator one after another and walk to theirs; the board comes up as a challenge's does → the match (PR 10's battle).
3. The match ends → the **usual victory or defeat screen** (the game's own Results, with the floor and run in its line). Then back
   into the floor room, standing there. Won: the elevator's doors open; walk in (or tap it) → the room again with N+1 on the walls,
   the next bosses walk out (the loop). Lost or drawn: the run is over; leaving takes you down to the lobby.
4. **Stopping:** leave the floor room between floors (walk out through the elevator to the lobby, or Back): the run is saved; next
   time the clerk says Continue: floor N. Mid-match leaving keeps PR 10's rules (free before your 2nd move, a loss after; the confirm says so).
5. Reduced motion: no walking, the number changes with a fade. Every figure whole on screen (Nov 4), phone and computer.
**Tests:** rework `e2e/battle-tower.spec.ts` to this flow (clerk → elevator → floor room → match → result → back in the room → elevator
→ floor 2 with its number; a loss ends the run; Continue after a reload); keep its `areas.json` entry. Decision note: Eric's words
above, the screen removed. Area pages updated (at most 5 lines each). Watch it frame by frame with real taps. Stills for Eric at the
end: the clerk's card, the floor room with bosses walking out, the result, back in the room with the elevator open (phone; one
computer). Done: `.pr-body.md` (under 40 lines, changed checks old → new) and `.done`; push and end. No PRs, no CI waits.
