# Birdie's ride, redrawn from his real train (Nov 23, round 9)

Stills of `birdie-train-ride` (Birdie's Train, the ride under the pawn), drawn from the reference pictures of his train
(`scripts/boss-art/refs/birdie-train/`: the board train, Birdie riding it, and the game's own screenshot).

- **Shape:** long and low, wider than tall, a flat dark roof with the hatch cut into it, the red stripe along the body and
  round the nose, round headlights, grey wheel trucks. Not a steam locomotive (round 8's tall red engine is gone).
- **Color:** the painted part is the body and the cab's yellow, so the Yellow color matches his train. The stills show the
  default Red (the director decides the default color later).
- **Caveat:** the Yellow tile in `compare.png` is the runner's town-size sheet, enlarged. The main side and motion frames
  are in Red, so a full-size Yellow still is still to make if Eric wants one.

## Files
- `idle.png`, `move.png`: the side view (frames at 4x, and the town-size moves).
- `views.png`: front and back views beside the side view.
- `trail.png`: the rail-tie trail mark.
- `ride.gif`: the ride running right, left, up and down, then standing in its idle.
- `compare.png`: the new side view (Yellow tile) next to the game's own screenshot of his train.

## Spend (API, Eric's yes asked once in this session)
- Side ride (`--rider`, cap $3): **$0.64**.
- Front and back views (`--rider-views`, cap $3): **$0.67**.
- Trail mark (`--rider-trail`, cap $1.50): **$0.22**.
- Total: **$1.53** of API credit (plan usage: none).

## Calls made
- The in-game still is at `birdie/phone-ride.png` on `origin/stills/birdie-build` (the brief's path was missing its folder).
- The reference folder is force-added to git, since `scripts/boss-art/refs` is in .gitignore; the PNGs are small.
- Tier left as the runner's placeholder ("legendary") for the director to set.
- The dark roof over the cab is the train's flat roof with the hatch cut into it; no canopy over the pawn (that would make the tall cab the brief rules out).
