# Eric's Nov 2 fixes: your ride goes into shops, Timber Gnaws twice at most, the 🐟 plays Stockfish, no early praise

Branch `claude/nov2-fixes`, from `claude/shop-interiors` (#458: once it merges, this diff is only these commits). Decision note:
`docs/decisions/2026-11-02-nov2-fixes.md`. Area pages updated: `docs/areas/town-square.md`, `bosses.md`, `god-king.md`.

## What changed

1. **Your ride goes into shops with you** (Eric: "your rider goes in with you"). Inside Babur's tent and Puddles' greenhouse you're
   drawn on your ride: the town's own rider (its frames as `town/rides.ts` composed them, the ride at 0.75 of the pawn), at the
   room's camera, its idle standing and its move a cycle a step, its side, back (up the room) or front (down it) the way you go, at
   its own pace (`RIDES.speed`). You come out still on it. No ride: on foot, as before. The old way (the ride waits outside) is one
   setting: `SHOP_FEEL.rideInside: true` (false brings it back). `ShopRoom.tsx` (`drawRiding`, `roomView`: a room's rows run toward
   the camera, so the Walker's back and front views swap), `Town.tsx` (passes `youRider`), `feel.ts`.
2. **Timber Gnaws at most 2 times a battle** (Eric: "After 2 times, his meter just stops charging"). `BOSS_POWERS.maxUltimates:
   { timber: 2 }` in his settings block (keyed by boss so it doesn't read as every boss's). Reuses Smudgy's cap (`ultimateMax`;
   `ultimateRunning` holds after the last, so nothing gathers; the admins' trigger refuses and its ⚡ goes, as for Smudgy). New rule
   flag `spentMeterShown`: his meter stays on the bar, empty and dimmed (the paused style), instead of going as Smudgy's does.
   Server, solo and the sims all decide it in the shared rules (`packages/chess`), so one change covers all three.
3. **The admins' Engine move (🐟) plays Stockfish at full strength.** What it was before: **never Maia.** It played the top of the
   judge's ranking from the power-up hints' search (`runner.topMovesFor`): Stockfish 19 lite on the device, 250,000 nodes spread over
   eight lines (MultiPV 8), with the boss's judge re-ranking applied. Its title read "Engine move · Maia 1450 · …": that was the
   *boss's* brain line, which is what looked like Maia. Now: its own search, `runner.engineBest`: Stockfish, one line, no strength
   limit, `BOSS_POWERS.engineMoveNodes` 1,000,000 nodes, over the moves the turn allows; on the judge's engine, so it waits for
   Stockfish while it's paused or busy. Title: "Engine move (Stockfish) · Boss: <the boss's brain line>". The bosses' own brain is
   unchanged (Maia, Eric's Oct 12 rule). Calls: no boss judge re-ranking (G-REX's fire) on the cheat (Eric asked for Stockfish's
   move); the Hidden Boss's phase 2 board keeps its quick one-line Stockfish search (four bullet boards).
4. **The God King doesn't praise a move in a game's first 10 moves** (Eric: "a masterful play on my first move … let's just make it
   the first 10 moves of the game"). `KING_SPEECH.praiseFromMove: 11`: his `greatMove` ("Masterful! Even I'd play that.", "A move
   worthy of a crown!", "Brilliant. The boss trembles.") and `goodMove` ("Well struck!", "A fine move.", …) only from move 11.
   **Counted as full moves**: the move's number in the game (the FEN's), so either side's first ten moves from the start; a battle
   that starts from the game so far counts the game's moves. Every mode where he comments goes through `crowdMoveCues` (Boss alone,
   raids solo and online). His other words on a move (a capture, a check given, a queen won, a bad move) are unchanged; the bots'
   "great move" chat in 50 v 50 isn't his and is unchanged.

## Every player-visible change and new text

- Inside a shop, on your ride (rides are admins' for now): the ride under you, walking and standing as outside; out again on it.
- Timber (admins first) after his second Gnaw: his rage meter stays empty and dimmed for the rest of the battle. **New text**: its
  title and accessible name "Rage: no more ultimates this battle". The FAQ's Timber block (shows once he's live) adds: "At most 2
  Gnaws a battle: after that his rage meter stays empty."
- The 🐟 (admins, Boss alone): **new title** "Engine move (Stockfish) · Boss: …" (was "Engine move · …"); it now plays a deeper,
  one-line Stockfish move (about 1 to 3 s on a phone where the hints' search was well under a second).
- Everyone: no "Masterful!"-style praise from the God King in a game's first 10 moves.

## Checks changed (old → new)

- `e2e/boss-dock.spec.ts` (the admins' ⚡ and 🐟), the 🐟's title, two checks:
  `/^Engine move · .*Maia/` → `/^Engine move \(Stockfish\) · Boss: .*Maia/` (computer) and
  `/^Engine move · Maia \d+ · no guard/` → `/^Engine move \(Stockfish\) · Boss: Maia \d+ · no guard/` (phone).
- None removed. No guard of `docs/rules/eric.md` changed.

Added: `packages/chess/test/timber.test.ts` ("Gnaws at most twice a battle": a third never fires, the meter at 0 and held after two,
the trigger refusing; "Engine move: Stockfish at full strength": one line at 1,000,000 nodes over the allowed moves, never
`playAtElo`); `packages/app/test/engine-move.test.ts` (SoloMatch's 🐟 plays the deep search's best; the title);
`packages/app/test/god-king.test.ts` (no praise through move 10, either side; from 11 as before; a capture still said);
`e2e/shop.spec.ts` ("on a ride": idle inside, its move's frames and its back walking up to the counter, out still on it).

## Tests run locally

Typecheck clean. Vitest: `timber.test.ts` (16), `engine-move.test.ts` (6), `boss-clock.test.ts` (4), `god-king.test.ts` (14),
`faq.test.ts`, `boss-kit.test.ts`, `smudgy.test.ts`: all pass. E2E (under the lock, own port): `e2e/shop.spec.ts`, phone and
desktop, 6/6. Not run locally: `e2e/timber.spec.ts` and `e2e/boss-dock.spec.ts` (CI's; neither needs a third Gnaw).

## Stills (`docs/nov2-fixes/`)

`babur-balloon-pup-phone.png` (Babur's tent on Balloon Pup, phone), `babur-balloon-pup-walking-phone.png` (walking up to Stripes,
its back), `babur-balloon-pup-out-phone.png` (out at the tent's door, still on it), `puddles-puddles-mower-phone.png` (the
greenhouse on Puddles's Mower), `babur-balloon-pup-desktop.png`, `puddles-puddles-mower-desktop.png`.

## Lane

Targeted, with Timber's cap in the boss lane (his rules; the boss kit test passes). Touched areas: the town square (shops), bosses
(Timber, the 🐟), the God King's lines. The director decides on the boss lane's review pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
