# Battle Tower audit 1: the fixes (Nov 19). Opus, xhigh, alone. Targeted lane + boss kit (one PR)

The audit: `git fetch origin audit/battle-tower-1 && git show origin/audit/battle-tower-1:docs/decisions/2026-11-19-battle-tower-audit-1.md`.
Read it in full, then CLAUDE.md. Branch `claude/tower-audit-1-fixes` from main; first merge `origin/audit/battle-tower-1` in (it adds the
audit file; delete its `.done`), so the report lands on main with the fixes. Fix at the cause (CLAUDE.md, Nov 13), the audit's fixes
as the starting point; each fix's test fails before it (show it):
- **Finding 1 (en passant square the engine drops, live in Babur's and Timber's battles today):** one rule in `rules.ts` for "the en
  passant square the engine keeps" (Alfil's `editedFen` rule: the square and the one behind it empty, the pawn there, a taker beside),
  used by `editedFen`, `tidyEnPassant` (Timber, Don Dough's `riseCheck`) and tiger's `placed`/`landCheck`; and `landCheck` refuses the
  square behind the en passant square as it refuses the square itself. Test: the audit's FEN and kit seed.
- **Finding 2 (Chandy's last-chance Dodge on a shared floor): the director's call, yes** (the design: every boss behaves on a floor as
  in his own battle; Eric, Nov 16: "he still fires his ult anyway"): an optional `ultimateNow?` hook (Chandy's: `mateOpen`), and
  `prepareSide` doesn't hold him when it says yes (he goes first that turn change, the others wait); `mateOpen` on a side asks the
  side's allowed moves. Test: the audit's Scholar's-mate table, every order. Record the call in a short decision note.
- **Finding 3:** `creaseDue` reads the floor's rates (`rageRates()` through `Battle`) everywhere it's called (runner, lobby).
- **Finding 4:** kit invariant 9 compares against the other boss's own part only (skip a boss with no `sideStops`; skip when his
  `sideStops` alone leave that single move). Test: the audit's two seeds pass.
- **Finding 5:** the parity test's host picks extra moves as `net.ts` does (by the boss in focus); the cap's last turn left out of
  the events compared. Don't widen the parity list in this PR (the party PR will).
- **Finding 6:** `turnOf: null` in `restore`'s list. **The nits** (the doc comment order in settings.ts, the double `blackedOut`, the
  design's "Status" line).
- **Finding 7 is PR 8's** (the deal): don't change `startSide` here.
**The 1-boss guard holds:** no existing one-boss assertion edited except where finding 1 changes a position on purpose (list each).
Area pages: bosses.md (Babur, Timber, Chandy rows if their rules text changes), battle-tower.md. FAQ only if a rule a player reads
changed. Done: `.pr-body.md` (lane, what changed, player-visible changes, changed checks old → new; under 60 lines) and `.done`; push and end.
No PRs, no CI waits. If something only Eric can decide comes up, `.question` and end.
