# Brief: the street town, round 2: the new layout, admins first (code; Opus high)

Worktree `/home/user/cr-townlayout`, branch `claude/town-layout`, from main (the director creates it). Run `npm ci`. Push as you go.
Ports 8993, inspector 9493. Include notes/briefs/rules-common.md. Eric has said this can run beside other helpers (Nov 5).

**Eric approved the street town** (Nov 5). The art and the exact plan are on `origin/claude/boss-art` at 11a4d903. Read them with
`git show`, and read these first, whole:
- `scripts/boss-art/out/town-art-nov5.md`
- `scripts/boss-art/out/town-plan-nov5.md` and `town-plan-nov5.json`, the data: streets, lots, door squares, wander boxes, the park,
  the grove, camera headings, turn zones, walkable squares, the start
- `out/town-street-mockup-nov5.md` (why)
- the stills in `out/town-art/`

Copy the art in as the shop art was: `out/town-buildings/{town-kit,buildings,home-boxes,dressing}.ts` go into `packages/app/src/town/`,
beside the homes.

## Admins first (the whole new town)
The new town ships **only in an admin's town** until round 3 (the boxes and the camera turn) is done. Use a switch beside
`ADMIN_TOWN`, `STREET_TOWN` (admins only), so Eric can walk it while everyone else keeps today's town. Every existing town test keeps
passing for a player's town. New tests cover the admin's street town. Taking the switch away later makes it everyone's.

## This round: the layout, at today's camera
- **The world:** still 46 x 46 and still wrapping, laid out from the JSON. That means:
  - the streets (chessboard) with a sidewalk each side;
  - the lots and everyday buildings drawn as their fronts, with the bigger buildings behind;
  - back gardens with hedges on the near side;
  - the Colosseum where it is, in its grove;
  - the plus-shaped park with its 12 tables, trees, lamps and the fountain at the crossing.
- **Walking:** walkable squares and the start come from the JSON. Taps and the arrow keys walk as today.
  - A tap on a home walks you to its **door square** and opens its card; running into it with an arrow opens the card too (the rule
    from #495, now with the JSON's door squares).
  - Bosses wander only their own wander box (their yard and the sidewalk in front) and rest where the art says, so the door and sign
    stay in view. Bots walk the streets, sidewalks and park.
  - The bots' tables are the park's 12. Statues, lamps and the bots' turns all move to the new map.
- **The camera:** default **zoomed in** in the street town (Eric, Nov 5), still facing north everywhere this round.
  - Seam Avenue faces east and needs round 3's turn. Until then, either draw its fronts facing north (a stand-in) or keep the avenue
    out of reach with a note; say which you chose.
  - Keep the sky over the rooftops.
- **Timber's and Dash's homes** are in the game for admins first, so the admin street town has them. Their fronts are drafts with no
  sign data (see the art notes): add their signs. In a player's town they're not there anyway (this round is admins only).
- **Frame rate:** fronts only this round (no sides yet). Measure the street town against today's town (phone 390x844 and computer
  1440x900, headless, walking 5 s, medians of a few runs) and report the numbers.
- **Sprites always on screen (Eric, Nov 4).** No emoji for any boss (Nov 5).

## Done
- **Unit tests:** the layout matches the JSON (every lot, door, wander box, walkable square, start); the park has 12 tables; every home's
  door square is reachable and a tap on its plot leads there; the bosses stay in their boxes; the bots never stand on a door or a
  table's square.
- **e2e (admin's street town, phone and computer):**
  - the town opens zoomed in, at the start, facing north;
  - walking down Fountain Street to Ginger's door, where the card opens;
  - arrowing into Smudgy's opens his card;
  - a park table works;
  - a player's town is unchanged (the existing tests).
- **Stills in `docs/street-town/`:** each street, the park, and a home's card, on phone and computer. No GIFs.
- **PR body** in `docs/street-town/pr-body.md`: every player-visible change (admins only), changed checks old → new, the frame-rate
  numbers, and the lane (full e2e, because the town is shared).
- Push, but don't open a PR. Send a short report.
