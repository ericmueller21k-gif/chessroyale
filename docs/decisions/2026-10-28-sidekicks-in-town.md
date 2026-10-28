# The town square: the bosses' sidekicks walk the town (Oct 28, 2026)

Phone and computer (Eric named neither). Builds on the town bots (`2026-10-27-town-bots.md`), which kept a bot's `look` one
field so a sprite could replace the pawn.

## Eric's words (Oct 27-28, trimmed)

The town bots become the bosses' sidekicks, little kid versions of each boss (drawn already; Eric approved every one).
"throw … from the lowest to the highest and just up each … bot by 100 … in batches of 100 ELO starting from the bottom.
Just work our way up to the top." And a twist for Hollow's: "one of the toddlers be actually like stronger than his boss
equivalent … his boss says something about it … something eerie about how powerful he is." Eric approved these three lines
for Hollow ("lol perfect"), word for word:

- "The little one plays in the dark. Even I don't sit across from him."
- "Don't let the eyes fool you. He's stronger than I ever was."
- "I found him in the dark. The dark had been teaching him."

## What it is

- **Twenty bots, a ladder from 600 to 2500 in steps of 100**, each rung once (`BOTS` in `town/world.ts`, the one table;
  names and ratings live there and nowhere else). Shown everywhere as "<name> (bot)", as before.
- **Six of them in the square at once** (as many as before), the others at home, taking turns (twenty cost about 3 frames
  a second: Eric's frame-rate rule, the numbers below).
  - **The six pawns** keep their names and clothes, one every three rungs (the director's call: the ladder never has a
    long run without a familiar face): Pin Pete 600, Rook Rita 900, Fork Frank 1200, Tempo Tess 1500, Bishop Bo 1800,
    Gambit Gus 2100.
  - **The fourteen sidekicks** take the other rungs, an easier boss's kid lower, and **Glim, Hollow's critter, on top at
    2500** (Eric's twist: stronger than Hollow). The names are the director's suggestions (Eric may rename them: the table
    is the only place).
- **A sidekick's look is its sprite** (`Look` is a pawn's or `{ sprite }`). It walks with `walk`, stands with `idle`, sits
  at a table with `sit` (facing the board), and plays `wave` once when you tap it, then stands (`idle`) while its card is
  open. Mirrored when it walks or sits facing our left, as pawns are. As tall as a bot's pawn, feet where a pawn's base
  stands; name tags as before.
- **Its card**: "<name> (bot)", **"<Boss>'s sidekick"** under it (the director's suggestion), "Rating 1400", Play. The
  pawns' cards are as before.
- **Hollow's card** (a tap on Hollow or on Hollow Peak) shows one of his three lines under its title, the next one each
  time the card opens. Only Hollow's card has lines.
- **The game against a sidekick** is the bot game as before (Maia at its rating on this device, the same loading step and
  Stockfish fallback; casual, nothing sent to the server); its strip shows the sidekick's face (its idle's first frame) in
  place of the pawn, and so does the loading step's card.

## The ladder

"Easier" = the crowd scores more against the boss in its latest sim (`docs/areas/bosses.md`, `reports/*-sim.md`):

| Rung | Sidekick | Boss | Crowd's score (the latest sim) |
| --- | --- | --- | --- |
| 700 | Squirt | Boingo | 0.62 (Oct 15, the pack: `reports/alfil-sim.md`) |
| 800 | Tex | Wrangler | 0.50 (Oct 15, the pack) |
| 1000 | Dabble | Smudgy | 0.44 (`reports/smudgy-sim.md`, offset 0) |
| 1100 | Blocky | Big Boy | 0.35 (the pack, "today's code") |
| 1300 | Bun & Bug | Chub & Chirp | 0.31 (`reports/hopper-sim.md`) |
| 1400 | Pleat | Folio | 0.28 (`reports/folio-sim.md`, shipped) |
| 1600 | Twinkle | Moo & Moon | 0.21 (`reports/moo-sim.md`) |
| 1700 | Drizzle | Puddles | 0.17 (`reports/gardener-sim.md`) |
| 1900 | Chip | Sawyer | 0.15 (the pack, "today's code") |
| 2000 | Stripes | Babur | 0.12 in 44 moves (`reports/tiger-sim.md`, hoops after his move, as shipped) |
| 2200 | Woolly | Alfil | 0.12 in 31 moves (`reports/alfil-sim.md`, `tusksEvery` 8, as shipped) |
| 2300 | Crumb | Ginger | 0.08 (Oct 15, the pack) |
| 2400 | Sparky | Jefferson | 0.04 (Oct 15, the pack) |
| 2500 | Glim | Hollow | 0.79, the easiest boss: Eric's twist puts his kid on top |

Every boss has a usable number. Calls: **Babur and Alfil tie at 0.12**; Alfil's battles are much shorter (31 crowd moves
to 44), so he counts as the harder boss and Woolly takes the higher rung. **Babur's number** is his raid sim after his
hoops moved after his move (0.12, the last sim on his shipped powers); the earlier raid check's 0.35 (#333) had his hoops
as his whole turn. The pack's older numbers (Ginger, Boingo, Jefferson, Wrangler: Oct 15) are their latest runs.

## Calls

- **The art copied as drawn.** Each sidekick's `.ts` from `origin/claude/boss-art` (Jefferson's `sidekick-jefferson-sonnet-2`
  and Babur's `sidekick-babur-opus`, Eric's picks) into `packages/app/src/characters/sidekicks/<boss>.ts`, ids
  `sidekick-<boss>`. Changes: the imports' paths; `import type { …, type X }` (not valid TypeScript) made `import type
  { …, X }` in Big Boy's and Wrangler's; the exports' and ids' names for Jefferson's and Babur's; and three type-only fixes
  the app's stricter settings asked for (a cast in Chub & Chirp's, two non-null marks in Folio's, a cast through `unknown`
  in Smudgy's). Every frame of every animation was checked pixel for pixel before and after (a hash of all frames): the
  same. All fourteen have `idle`, `walk`, `sit` and `wave`.
- **The frames are baked, not drawn in the town** (`scripts/bake-sidekicks.ts`: one PNG a sidekick, rows idle, walk, sit
  and wave, about 200 KB for the fourteen, and their times, feet and heads in `town/sidekick-sheets.ts`). The first build
  imported the sprites and drew their 875 frames as the town opened: frame rates as main, but **the town's first frame
  came about 2.8 s later** (median 2.46 s on main, 5.32 s on the phone; 2.50 s and 5.27 s on the computer). Most of it is
  the sprites' own code painting their parts as it loads (about 3 s in Node for the fourteen; Smudgy's alone 1.1 s), the
  rest drawing the frames (0.6 s). A worker would move that off the page's thread but still spend seconds of a phone's
  CPU each time the town opens, with the sidekicks missing meanwhile. Baked, no art code runs in the town: it loads
  fourteen small pictures and cuts each frame into a canvas once, as they arrive (a sidekick isn't drawn until its
  picture has loaded: a moment). A unit test re-draws every frame from the sprites and checks the sheets' hashes, so a
  sheet can't go stale (after changing a sidekick: `npx tsx scripts/bake-sidekicks.ts`).
- **Sitting**: a sidekick's `sit` has its own little stool; it's drawn on the table's stool as it is (not lowered and
  clipped like a pawn's), facing the board, with no shadow of its own (the stool's is there).
- **The wave**: once, from the tap that opens its card; a sidekick sitting at a table doesn't wave (its wave stands up:
  it would jump off its stool). A sidekick walking when tapped waves as it stops (the bot holds still while its card is
  open, as before).
- **Height**: every sidekick as tall as a bot's pawn from its idle's top to its feet (`sidekickSquares` 0.87 squares; a
  bot's pawn's body is 0.69 of its 1.25-square box). The kids differ in shape, not in height.
- **The bots start off the stools.** With twenty spread round you, some started on a stool (sitting from the start);
  they now start beside the tables and sit as they wander (every table free as the town opens, as before).
- **"Puddles' sidekick"**, as his home's sign has it ("Puddles' Botanical Garden"), not "Puddles's".
- **Hollow's line**: one counter for Hollow (his card and his home's share it); his confirm doesn't move it on. In italics
  under the title, Eric's words exactly, no quotation marks.
- **Six out at once** (`botsOut`; the numbers below): the brief's own corner to cut. Pawns and sidekicks take turns
  alike. The turns never take the bot you just played, one held by its card or one sitting at a table.
- **The face on the strip**: made once as you both sit (the idle's first frame cut to what's drawn, square, as an
  image's address), passed with the game's name and rating; the main bundle never loads the sidekicks' art.
- **Stockfish's floor**: where Maia can't run, the fallback can't play below Stockfish's floor (1320, `ENGINE_MIN_ELO`),
  so the rungs from 600 to 1300 play at 1320 there (as the 800 bot did). Unchanged. Maia's own range for the bot game is
  600 to 2500 (`RANKED_1V1.bot`), so the whole ladder is Maia's where it runs.

## Frame rates and start times (Eric's rule)

Measured as the slice 2 decision says: headless Chromium, the default view (`/town?sky=day`, zoomed out), warmed 4 s,
then 5 s walking (a tap ahead every 1.25 s, left and right in turn); a phone 390 × 844 at 3×, a computer 1440 × 900;
main and the branch built and measured in turn (main, branch, main, branch…), frames a second, medians. The start: from
the page's navigation to the town's first frame drawn (its chunk, the world and, here, the sidekicks). A busy machine
(other helpers running), so several rounds; the differences of one round within ±3 fps are noise.

| Build | Rounds | Phone fps | Computer fps | Phone start | Computer start |
| --- | --- | --- | --- | --- | --- |
| main | 4 | 54.2 | 42.9 | 2463 ms | 2503 ms |
| twenty out, the art drawn as the town opens | 4 | 54.0 | 41.0 | **5318 ms** | **5271 ms** |
| main | 10 | 51.5 | 40.3 | 3015 ms | 2840 ms |
| twenty out, baked | 10 | **48.9** | **37.7** | 2766 ms | 2812 ms |
| main | 7 / 6 | 51.7 | 40.3 | 2817 ms | 2792 ms |
| ten out, baked | 6 | 51.2 | 40.8 | 3053 ms | 2630 ms |
| eight out, baked (tried) | 6 | 51.5 | 40.3 | 2713 ms | 2762 ms |
| main / ten out (a busy machine) | 6 | 45.8 / 42.8 | 35.8 / 32.9 | 4165 / 4130 ms | 4496 / 4020 ms |
| main / ten out (busier) | 8 | 43.0 / 42.2 | 32.1 / 29.4 | 4685 / 4769 ms | 4671 / 4628 ms |
| main / six out / ten out (busiest: main's computer runs from 21 to 37 fps) | 6 | 41.4 / 40.0 / 38.6 | 31.5 / 27.9 / 30.1 | 4266 / 4388 / 4307 ms | 4759 / 5043 / 4844 ms |

- **The art drawn in the town cost the start**: about 2.8 s more before the first frame, on both. Baked, the start is
  main's.
- **Twenty out cost frames**: about 3 fps on both (the same in two more rounds of 4 and 6: phone 53.0 → 50.3 and 52.6 →
  47.9). The main thread's busy time a frame went from 19.1 to 20.3 ms on the phone and 24.7 to 26.5 ms on the
  computer: the fourteen more figures, their shadows and name tags drawn each frame (the JavaScript's own share is small;
  most is the drawing). Two tries told no single culprit (no sidekicks' tags: 51.2 / 38.4; no sidekicks drawn: 49.8 /
  40.0; main 53.1 / 38.6 in that round).
- **So the corner is cut, as the brief says: six out at once, the rest at home, taking turns** (`botsOut` 6). In the one
  calm round ten out cost nothing measurable (51.2 / 40.8 to main's 51.7 / 40.3), and eight no less; the later rounds ran
  on a much busier machine, where even six out (main's own count) read lower than main, so they can't tell a fps or two
  apart. Six is main's count of figures in the square, each drawn the same way (one image made once), so its frame rate
  is main's by construction; ten is one number away (`botsOut` in `feel.ts`) once Eric's phone shows the room. Every 10 to
  20 s one bot out (standing, free, at least 5 steps from you) goes home, fading out, and one from home comes out on a
  free square in the park as far from you, fading in. Back from a game, the bot you played is out; a bot whose card is open stays. Who's out first is a
  shuffle by the town's seed (the same each time the town opens, so the tests see the same town); the turns change it
  within seconds.
- **What's new on the hot path**: for each bot out, a sidekick's frame picked from its canvases (a short loop over its
  frames' end times, nothing allocated) instead of its dressed pawn; its fade (one multiply). The turns run between
  frames' work only when the bots' timer fires (an array of the free ones then, as the wander already did). Maia never
  loads in the town (the e2e check is unchanged).

## Tests

- `packages/app/test/town-bots.test.ts`: the table (twenty, 600 to 2500 by 100, each rung once, names at most 10
  characters, Glim (Hollow's) 2500); the six pawns' names, rungs and clothes; the fourteen sidekicks (one a boss, in the
  ladder's order, each with idle, walk, sit and wave); every sheet against its sprite (times, size, feet and a hash of
  every frame); the card's line ("Hollow's sidekick", "Puddles' sidekick", none for a pawn); Hollow's three lines in
  turn (no other home has lines); a sidekick's animation (idle, wave once after a tap, walk, sit); the turns (six out,
  the rest at home on no square, never more than one extra out while one fades, apart, a held bot staying, every bot out
  in time; back from a game the bot you played is out; one called from home comes out).
- `packages/app/test/town-bot-game.test.ts`: a sidekick's face on its strip, at its rating.
- `e2e/town.spec.ts` (phone and desktop): a tap on Glim, it waves, then stands while its card is open ("Glim (bot)",
  "Hollow's sidekick", "Rating 2500", Play); Play, the game with its face on its strip, one move each, resign, back at the
  table with Glim across in its sit. Hollow Peak's card shows his first line, closed and opened again his second (a new
  hook, `__townGlide(id)`, takes the camera there). Babur's card has no line.
- **Test checks changed** (none guards a rule in `docs/rules/eric.md`; `e2e/town.spec.ts`'s check that nothing of
  Maia's is fetched in the town is unchanged):
  - `town-bots.test.ts`, "six bots, names of 8 to 10 characters, ratings spread from 800 to 2000, each in one or two crate
    items" → "twenty bots, a ladder from 600 to 2500 by 100 … at most 10 characters" and "the six pawns keep their names
    and clothes … at 600, 900, 1200, 1500, 1800 and 2100" (the crate items' checks kept for the pawns).
  - `town-bots.test.ts`, Tempo Tess's texts: "Rating 1400" → "Rating 1500", "Play Tempo Tess (bot) · 1400" → "… · 1500".
  - `town-bots.test.ts`, a seat that's no seat: "1.0.6" (bot 6 of six) → "1.0.20" (bot 20 of twenty).
  - `town-bots.test.ts` and `town-world.test.ts`'s town helpers (`still()`, and three tests that make a town) keep every
    bot out (`createTown(…, BOTS.length)`), so their checks see the twenty as before; the statue and sitting tests
    run with the turns on.
  - `e2e/town.spec.ts`, Tempo Tess's card: "Rating 1400" → her rating from `BOTS` ("Rating 1500"), and her card has no
    "sidekick" line. Babur's card: no line (added).
  - `e2e/areas.json`: the sidekicks' art (`packages/app/src/characters/sidekicks/**`) runs the town's spec.
