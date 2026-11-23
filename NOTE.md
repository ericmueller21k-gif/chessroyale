# Birdie art round 7: lobby and bartender (Nov 23)

## Done
- Lobby, `shop-birdie-interior-2` (12 x 12): finished, called done at turn 30. Drawing: `scripts/boss-art/out/shop-birdie-interior-2/shop-birdie-interior-2.ts` on `claude/boss-art`.
- Bartender, `sidekick-birdie` (id `sidekick-birdie-bartender`): finished. Drawing: `scripts/boss-art/out/sidekick-birdie/sidekick-birdie.ts` on `claude/boss-art`.

## Spend (API dollars, Opus 5.5 high; plan usage: none)
- Lobby, first run (stopped at its $5 cap at turn 8, no done, kept as `shop-birdie-interior-2-stopped`): $3.10
- Lobby, second run (killed by a worker restart at turn 7, kept as a partial record): $0.46
- Lobby, third run (fresh start from the same brief, cap $10, done at turn 30): $5.10
- Bartender (cap $5, done): $2.02
- **Total: $10.68.** Eric's first approval was "about $10 at most" for the two runs. He then said "Just finish it don't care the cost" for the lobby, which covers the extra runs.

## Open
- Eric's new notes (shelves of seed, bird feeders on the counter, the seed vat beside the bartender, and the bartender scooping seed into a feeder) are NOT in these drawings. They need the briefs changed and another run.
- The lobby's room is 12 x 12. The game's `makeRoom` defaults to n=20, and the game's shop call site (`ShopRoom.tsx`) doesn't pass n. The wiring must pass the room size.
- The bartender's preview only worked with the drawing's own id `sidekick-birdie-bartender`. The runner's id `sidekick-birdie` filtered it out.

## Stills (this branch)
- `lobby-first-frame.png`: the lobby's first frame.
- `lobby-idle.gif`: the lobby's idle loop.
- `bartender-idle.gif`, `bartender-wave.gif`, `bartender-frames-sheet.png`.
