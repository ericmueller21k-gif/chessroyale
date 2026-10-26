# The town square: the park stands back from the Coliseum (Oct 26, 2026)

## Eric's words
After trying slice 6: "The park is sick." Then: "just bring it away a bit more from the Coliseum. It shouldn't literally be
right next to it. I'd say a good, 8 to 10 tiles away … drop it almost to where five tiles down".

Afterward, seeing it: "where things are on the map is not an issue. If we need to move buildings around, this is all just
being built. It's all prototype. I love how you put the gray kind of concrete … with the path that leads to the
Colosseum."

So while the town is a prototype, homes and buildings move freely to make room. Placement needs no OK from Eric.

## The calls (director)
- **The Coliseum moved 5 rows north, not the park 5 rows south** (`COLISEUM.r0` 23 → 28). Dropping the park would have put
  it on Babur's Circus. Moving the Coliseum touches only one home: Alfil's Pyramid, behind it, moved one square back and one
  east, from (22, 42) to (23, 43), so its roaming ground stays off the Coliseum's back. Every home is still 8 to 10 squares
  from its nearest neighbor, and the map stays 46 × 46.
- **Between them: the apron (3 rows, as before), a walk of 4 rows of the town's board (`WALK_ROWS`), and a paved north
  walk on the park's own edge** (a new first row in `PARK_PLAN`, so the park is 11 deep and paved all round). The
  promenade's 4 paved squares carry on across the walk to the apron. The park's nearest tables are 9 rows from the
  Coliseum's wall, its north walk 8.
- **You start 4 rows further north** (`START` (22, 13) → (22, 17)): in the park on its promenade, between its two rows of
  tables nearest the Coliseum, with the fountain behind you. From the old square the Coliseum would have stood past the
  view's rim, hazy on the horizon. From the new one it stands whole on a phone, the walk across to it in front. On a
  computer its top still rises out of the view, as before.

## What changed
- `world.ts`: `COLISEUM.r0` 28, `WALK_ROWS` 4, `PARK.r1` from those (20), `PARK.d` 11, the plan's north walk, the
  promenade paved across the walk, `START`, Alfil's Pyramid.
- The statues moved with the Coliseum: they stand at (17, 27) and (28, 27).
- Tests: the park stands 8 to 10 rows back from the Coliseum, the walk between them is paved and open with no boss roaming
  on it; the start is at most 11 rows south of the Coliseum (was 10); the fountain's rows; the e2e gate and statue squares.
