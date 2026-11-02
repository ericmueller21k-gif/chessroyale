# Brief: Eric's Nov 2 fixes (ride into shops, Timber's ult cap, the cheat on Stockfish)

Worktree `/home/user/cr-nov2`, branch `claude/nov2-fixes`, started from `claude/shop-interiors` (PR #458, not merged yet; when
it merges your PR's diff shrinks to your own commits. If main moves, merge main in; never rebase). Opus high. Push as you go.

## 1. Your ride goes into shops with you
Eric: "you can keep that, the ride waiting outside in the back pocket, but I want the ride, your rider goes in with you."
- In `packages/app/src/town/shops/` you're on foot inside today (your ride waits outside). Make the ride you're on come in:
  drawn under/with you inside as the town draws it (the rides' drafts in `components/rides/`, lazy-loaded via `load.ts`),
  at the room's camera scale (the ride scale stays 0.75 of the pawn as in the town, Eric's setting), walking animation as outside.
- Keep the leave-outside code path behind one setting (`SHOP_FEEL.rideInside: true`), so it can be switched back.
- Going out: you come out still on it. No ride: on foot as now.
- Stills: Babur's room on a ride, phone; Puddles' room on another ride.

## 2. Timber ults at most 2 times a game
Eric: "make it so this beaver only ults up to 2 times a game. After 2 times, his meter just stops charging. Otherwise, it's too
strong."
- Find how his ultimate meter charges (Timber: `docs/decisions/2026-11-01-timber.md`, his powers in core/app). After his second
  ultimate in a game the meter stays empty and stops charging for the rest of that game. The number goes in settings
  (`maxUltimates: 2` in his settings block). Server and solo both, wherever his ult is decided.
- If other bosses have a cap mechanism already, reuse it. Show the stopped meter plainly (empty, maybe dimmed); no new text
  unless needed (list any).
- Tests: a unit test that a third ultimate never fires and the meter stays at 0 after two; keep `e2e/timber.spec.ts` passing.

## 3. The admins' Engine move (the 🐟 "cheat") on Stockfish
Eric: "switch the cheat? I think it's set to Maia for my own testing with the little fish icon. Can you set that back to
Stockfish?"
- The 🐟 button is "Engine move" (`components/BossDock.tsx` ~l.537, `solo.ts engineMove()` via `runner.topMovesFor`). Find out
  what really answers it today: Stockfish at full strength, or something weaker, or Maia (Stockfish is paused while Maia
  loads/plays: `maia-gate.ts`). Its title shows the brain line (`BrainDebug`), which says Maia for the boss: that may be what
  Eric saw.
- Make it play **Stockfish's best move at full strength** every time (wait for Stockfish if paused; never Maia's move). If the
  title's brain line reads as if the cheat were Maia, make the title say plainly "Engine move (Stockfish)" and keep the boss's
  brain line second. The bosses' own brain stays as it is (Maia, Eric's Oct 12 rule).
- Report what it was before, in the PR body.

## Done means
- Unit tests for 2 and 3; the shop spec extended for 1 (you're on a ride inside). Run only those locally (e2e lock).
- Stills in `docs/nov2-fixes/` (about 6). PR-body file `docs/nov2-fixes/pr-body.md`, listing every player-visible change.
