# Battle Tower PR 8: the climb's rules (Nov 19). Opus, xhigh, alone. Targeted lane

Read CLAUDE.md, the design `docs/decisions/2026-11-18-battle-tower-design.md` §3 (the climb: floors, strength, the deal, one loss out)
and §7 row 8, `docs/areas/battle-tower.md`, and the audit `docs/decisions/2026-11-19-battle-tower-audit-1.md` finding 7.
Branch `claude/tower-climb-rules` from main. Pure core logic, no screens, no server storage (PR 9), no rewards wiring (PR 10/12).
- **Core `tower.ts`** (packages/core): a floor's boss count (`pattern` looping), its brain and rating (Maia 600 +100, cap at Maia's top,
  a lone boss +200 within the cap; Stockfish from floor 51 at 2500 +25 to `ENGINE_MAX_ELO`, full strength from the floor it passes it),
  the deal (a seeded shuffled deck of the pool, every boss once before any twice, never the same boss on two floors in a row, never an
  `apart` pair, the next floor dealt as the floor before is won), the run's steps (start, win → next floor, loss or draw → over, leave:
  free before your 2nd move else a loss, floor 99 won → complete). A plain state + pure functions, ready for PR 9 to save.
- **`BATTLE_TOWER` in settings.ts** gets the design's numbers (`floors`, `pattern`, `maiaStart`, `maiaStep`, `soloBonus`, `stockfishFrom`,
  `stockfishStart`, `stockfishStep`): one place, plain comments.
- **Audit finding 7, the deal's input to the runner:** a floor's start takes its bosses from the deal, never ids a device chose;
  `startSide` (or the tower's start path) honors the kill switches (`bossesOff`, `rosterWithout`: a resting boss is never dealt; the
  pool reads them) and plays every boss at the floor's rating (no roster offset: design "each boss plays the floor's rating"); a bad
  list is refused cleanly, not thrown, on any path a room could reach (keep the throw for test switches if simplest; say which).
- **The pool:** every playable boss with powers but the Hidden Boss (its name never in text, commits or PRs), minus kill switches.
- **Tests (unit, packages/core or chess):** the design's table row by row; the deal over many seeds (no repeat before the deck ends,
  no back-to-back, no apart pair, the same seed → the same run); the run's steps; finding 7's three cases.
Decision note about five lines for any call made. Area page `docs/areas/battle-tower.md` updated. Done: `.pr-body.md` (lane, what
changed, changed checks old → new; under 50 lines) and `.done`; push and end. No PRs, no CI waits. `.question` for anything only Eric decides.
