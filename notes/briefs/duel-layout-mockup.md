# Ranked 1 v 1 on a computer: a chess.com-size board + rank emblems + "what ranks mean" pop-up (Nov 25). Opus high, MOCKUP (stills)

Eric (Nov 25, a ranked 1 v 1 vs a resident, Edge on Windows, window ~1856 × 960): "this size is all fucking wrong. This is not the size that
chess.com uses. Why the fuck is the board so small? ... that 1v1 rapid and the timer can probably be on the same line ... we have more room.
We're not utilizing this ... I swear this used to be bigger. And also the ranking where it says Illustrious 4, 67 RP. I don't know. So is each
rank out of 100? ... we should also put their emblem next to everyone ... click on someone's rank and then it shows the list of rankings ...
a pop-up that shows every rank." His screen: side menu left, "1 v 1 Rapid 10+5" title line with the gear far right, the opponent's strip (pawn,
name, "Illustrious 4 · 67 RP" pill, clock 10:00), the board (~695 px), his strip ("HunChess", "Placement 0/5", clock), and on the right "Your
move", "Offer a draw" and the chat panel. Lots of empty space left and right.

Start: `git fetch origin main && git checkout -B claude/duel-layout-mockup origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`
(nothing hidden, nothing shifts), `docs/areas/board.md` (the computer's board size: window height less 170 px, never wider than its column;
`board-size.css`, docs/decisions/2026-10-29-desktop-board-size.md), `docs/areas/ranked.md` (tiers Wood → Radiant, divisions 5 → 1 of 80 RP,
Pearlescent top 500, Transcendent top 100; the emblems `emblems/rank-emblems.ts`), `screens/Duel.tsx`. First: was it bigger before (git log on
board-size.css / Duel)? Say what changed, if anything.

Mockup (the real 1 v 1 screen with a test switch or a preview page; computer at 1280 × 800, 1440 × 900, 1920 × 1080 and Eric's ~1856 × 960;
phone 390 unchanged unless you see a clear win; light + dark):
1. **Board as big as chess.com's**: the board takes nearly the full height (only the two player strips above and below it, and no separate
   title line: "1 v 1 · Rapid 10+5" moves into the top strip or beside the clock, the gear stays reachable). Use the width: the right panel
   (Your move, Offer a draw, chat) sits right beside the board; no wasted gutters. Show the before/after board size in px at each window size.
2. **The rank emblem** next to every name (both strips; the ladder already has the emblem art), with the pill.
3. **Tap a rank → "Ranks" pop-up**: every tier's emblem in order, Wood to Radiant with "5 divisions, 80 RP each (5 is the lowest)", then
   Pearlescent (top 500) and Transcendent (top 100) by place; the tapped player's spot highlighted ("Illustrious 4 · 67 of 80 RP"); plain words
   on how RP moves (win to climb, lose to drop). The same pop-up from the ladder's rows and profiles' rank cards.
Deliver on orphan `stills/duel-layout-mockup` (before/after at each size, the pop-up), `NOTE.md` (sizes, what changed, build cost; does the same
board rule apply to other game screens?). Code on `claude/duel-layout-mockup`. `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Never images under docs/. Effort high. ~1 hour.
