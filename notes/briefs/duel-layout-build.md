# Build: ranked 1 v 1 on a computer (mockup round 2) + the side menu's labels whenever they fit (Nov 25). Opus high, targeted. Branch `claude/duel-layout` from origin/main

Eric approved (Nov 25: "Fix it please, looks bad", after the round-2 stills). Two parts, one PR:

## 1. The 1 v 1 layout on a computer, exactly as the mockup
The mockup: `git show origin/stills/game-layout-mockup:NOTE-duel-round2.md` (Eric's 7 asks → what the mock does, the board sizes, the build
cost) and its stills `stills/duel-round2/duel-play-*`; the mock itself `scripts/mockup/duel.css` + `duel-layout.spec.ts` on branch
`claude/game-layout-mockup` (reference only; build it in the real components, don't ship the mock CSS). In play: no title line; the
opponent's strip at the very top with "1 v 1 · Blitz 3+2" just before their clock; the gear top right level with that strip; the board the
window's height less the strips (621 at 1536x730, 848 at 1920x960, 928 at 1858x1040); the right panel's top and foot flush with the board's;
the panel = chat over one row (Offer a draw | Resign; a draw offer's Accept/Decline take that row); "Your move" a chip by your own clock.
The END page (shipped today, #944: its right column swapped in) must still match: it takes the same frame (board unchanged, column flush
with the board, `endGaps` passing). Phone unchanged. The ranks pop-up and emblems are already real.

## 2. The side menu's labels whenever they fit (every game screen)
Eric: "Why isn't the names on the left appearing there's plenty of space?" Today `game-frame.css` shows labels (232 px) only from 1800 px
wide, else icons (80 px) (docs/decisions/2026-11-01-game-screens-computer.md call 3: at 1366/1440 the labels cost the board 152 px). Fix the
CAUSE: show labels whenever they don't cost the board anything, not by a fixed width. Measure, for every game screen with the menu (1 v 1
new layout, 50 v 50, Boss alone/raid, Squads, auto chess if framed), the board at Eric's real sizes (REAL_SCREENS in e2e/helpers.ts:
1536x730, 1280x600, 1366x650, 1920x960, plus 1858x1040, 1440x900, 1280x800) with labels vs icons; then pick the simplest rule that gives
labels exactly where the board is unchanged (e.g. a min-aspect-ratio media query, or a per-screen check). Show the table in the PR body.
Laptop 1536x730 must get labels if the board stays 621.

## Checks and stills
- Update `desktop-board.spec` real-screens entries for the duel (the mockup NOTE says which), one focused check that the labels show at
  1536x730 and the board is unchanged vs icons; no eric.md guard edited (if one would be, stop and push `.question`).
- Stills: 1 v 1 in play and end page at 1536x730, 1920x960, 1858x1040; one other mode (50 v 50) at 1536x730 with labels. Push to
  `stills/duel-layout` (images only there). Look at each yourself (CLAUDE.md UI rules: aligned, nothing stretched, nothing hidden).
- Decision note (short), area page updates (`docs/areas/ranked.md` or the 1 v 1's, `hub.md` side menu), `.pr-body.md` (lane targeted;
  checks changed old → new). Push at each real step, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
  `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About half a day.
