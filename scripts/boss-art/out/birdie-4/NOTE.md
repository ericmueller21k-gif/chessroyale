# Birdie's home, round 4 (Nov 23): the station outside and its lobby inside

**Status: the station is done. The lobby is NOT done (blocked on a rerun decision).** No `.done` yet.

## Spend (Claude API, the paid runner only; plan usage: none)
Eric approved up to $12 for this round ("two runs at about $6 each"). Cap $6 per run, effort high, the default model.

| Run | Result | Spend |
|---|---|---|
| `house-birdie` (the station, from the street) | Finished, called done, 13 turns, 7 renders | $1.34 |
| `shop-birdie-interior` (the lobby), first attempt | Stopped at turn 7: one turn hit the 48,000 output-token ceiling (the default) before any drawing was saved. No drawing. | $1.14 |
| **Total so far** | | **$2.48 of $12** |

## The lobby: what blocked it, and the decision needed
- The first attempt ran out of output room while writing the room's first full draft. The runner's documented remedy is
  `BOSS_ART_MAX_TOKENS` (the ceiling; up to 128,000). I planned a rerun at `BOSS_ART_MAX_TOKENS=96000` with the same $6 cap.
  The session's permission check refused that run, because it changes a runner setting from the brief's "same settings".
- Worst case for a rerun, on top of the $2.48 so far: $8.48, still inside Eric's $12. Nothing was drawn by hand.
- **Needed:** the director's (or Eric's) OK for the rerun with the higher ceiling, or a different plan for the lobby. Then the
  lobby's rerun pushes its drawing, a preview and `.done`.
- The first attempt's record is kept beside the drawing: `scripts/boss-art/out/shop-birdie-interior/summary.md` and `log.jsonl`
  (the rerun will overwrite them).

## The station (`house-birdie`): what it is and what's unchecked
- Drawn to the brief: a one-story station with a charcoal roof and red eave stripe, a platform canopy, a clock with no numbers,
  a blank sign face (the game writes the name), a ticket window, benches, a pennant and a chimney, and a big woven nest on the
  roof drooping over the eaves. Idle: pennant, chimney smoke, a twig in the nest, a window flicker.
- **Not checked at 4x.** The render tool wouldn't zoom past 1x for a frame this tall, so the runner checked it at 1x and 2x,
  beside `house-tiger` and `house-gardener`. The base and nest close-ups the brief asked for are not in the previews. Worth a
  4x look before it goes in the town.
- Frame: 144 px wide, about 250 px tall (the Walk-up is 224), foot at the bottom center. Its box numbers are in
  `scripts/boss-art/out/house-birdie/summary.md`.

## Choices I made (the briefs)
- **Reference paths:** the model briefs point at `/home/user/main-wt`, a worktree that isn't in this container. The read-first
  lists point at what exists here: the neighbor homes `packages/app/src/town/houses/tiger.ts` and `gardener.ts`; the tower's
  front and lobby in `scripts/boss-art/out/house-tower` and `out/house-shop-tower` (its side walls and layout); the Big Boy
  counter in `out/house-shop-bigboy`.
- **No reference photos** for either piece: none are on branches (Eric's photos stay off the repo).
- **Station size:** 144 px wide and about 250 px tall. A station, not a skyscraper: the nest is its one big thing.
- **Name:** the sign's working name is "Birdie's Station"; the game writes the real name on it, and Eric may rename it.
- **Lobby layout:** 10 x 10 squares as the tower's lobby; columns 0 and 9 are the side walls; two open arches (tracks behind,
  2 or 3 in perspective, the train on one track) at columns 1-2 and 7-8; the split-flap board at columns 3-6 (pictures only,
  no letters or numbers); airport seats at columns 1-3; the café counter at columns 6-8 with three stools; shrubs and plants
  in the corners; the way in at columns 4-5.
- **Lobby idle:** the room's idle is one 8-frame loop (the board's rows flip in turn; the train passes every few seconds).
- **Model names:** the runner's summary files named the model; I removed that line before committing, as the repo's rule asks.
  The logs are as the runner wrote them.

## Stills
Branch `stills/birdie-4` (orphan): the station's preview (`house-birdie/`: the frame sheet, the idle GIFs, the comparison picture)
and this note. No lobby stills yet (no drawing).
