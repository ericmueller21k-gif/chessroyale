# The town square (/town)

Boss raid's coming home: a small round world where players walk around and meet the bosses at their homes (the plan:
`ROADMAP.md`, "Boss raid: the town square"). **Slices 1 to 3** are the world alone, on a hidden address: the sky by
the time of day, the curved ground, all thirteen boss homes with their bosses roaming near them, six bots and you; slice 4
added the press, the trail and the cards; **slice 5 the Colosseum** in the middle; **slice 6** made the Colosseum about
twice its size, the map bigger, and put **the park** with its ten chess tables in front of its gate. Home's **Boss Arena** card (Oct 26, Eric)
opens it, and the computer's side menu's Boss Arena item; the address `/town` opens it directly too (`hunchess.com/town`,
behind Cloudflare Access like the rest of the site). Phone and computer.

## How it works

- **The page.** `App.tsx` mounts it at `/town` the way it mounts `/autochess`; `town/TownPage.tsx` loads the rest with a
  dynamic `import()`, so none of its code, art or styles are in the main bundle. The back button goes home (and the
  address back to `/`). Stockfish isn't warmed on this page.
- **Layout.** A slim bar (the back button and "Town square"), then the world fills the rest of the screen. The world never
  assumes a screen size: it fills its box and works its camera out from the box's shape, so the panels Eric designs
  around it can change without touching it. The back button, the zoom pair and "Back to me" stay put.
- **The camera** (`town/camera.ts`, pure math): a pitched pinhole camera over a ground that drops away from the focus
  point (a small round world), cut at a rim that forms the horizon. Two tuned sets, the phone's and the computer's,
  blended by the box's width / height (0.6 = all phone, 1.4 = all computer). Zooming out raises the camera, moves it back,
  pitches it down and lets the rim reach further; the page opens zoomed out (`startZoomedOut`). The world is 46 × 46 squares (40 × 40 until slice 6) and wraps both ways. A tap picks the
  nearest drawn square under it (`pickSquare`). The far band of ground dissolves into the sky; things in it fade, haze
  and blur, and are drawn whole, never cut by the rim.
- **The layout** (`town/world.ts`, `HOMES`): thirteen homes spread evenly round the middle over the world that wraps, so
  neighbors stand 8 to 10 squares apart; the Colosseum on its 12 × 12 ground (`COLISEUM`, columns 17 to 28, rows 28 to 39),
  its gate facing south onto its apron (`APRON`: columns 17 to 28, rows 25 to 27, paved, kept open for people to gather),
  then a walk of 4 rows (`WALK_ROWS`, the promenade paved across it), the park south of that (`PARK`, below; it stands back
  from the Colosseum since Oct 26: `docs/decisions/2026-10-26-town-square-park-stands-back.md`), and your start (`START`,
  22, 17) in the park on its promenade, between its two rows of tables nearest the Colosseum, facing it. Ginger Igloo and Jefferson's Fireworks stand side by side, and so do Hollow Peak and Moo &
  Moon Meadow. Placement is free to change while the town is a prototype (Eric, Oct 26: "where things are on the map is
  not an issue. If we need to move buildings around… It's all prototype"). The map: `docs/decisions/2026-10-26-town-square-slice-6.md` (slice 3's smaller one:
  `docs/decisions/2026-10-26-town-square-slice-3.md`).
- **The world** (`town/world.ts`): the homes (3 × 3 plots) and the Colosseum (`COLISEUM_PLACE`; homes and the Colosseum
  are `Place`s: a name, a chip color, a middle, a half-size and where the picture's foot stands), the walk (square to
  square, around the homes and the Colosseum, by breadth-first search), the bosses' roaming and their lines (their `SELECT_LINES`, one at a time, only from a boss on
  screen), and the bots. **Everyone in the square is a `Person`** (`{ id, name, look, you, walker }`) in one list,
  `town.people`; the bots are one source that moves its people. The drawing and the taps read only that list, so real
  players (rooms of up to about 75 to 100, fed by a server, later) can replace the bots without touching either.
- **The drawing** (`town/render.ts`): one canvas, one `requestAnimationFrame` loop (in `Town.tsx`), stopped when the screen
  closes or the tab is hidden; device pixel ratio capped at 2; nothing allocated per frame on the hot path (square colors,
  fonts, gradients, clouds, pawns and every boss and home frame are made once, the frames the first time they show).
- **Taps** (slice 4: `town/press.ts`; cleaned up in slice 5). A finger down presses the square you'd walk to like a
  button: its face dims a little and one bold gold border lies on its edge, glowing outside only, while the finger is
  down; up on the same thing releases it with one short pulse of that border (brighter, a little wider, fading) and you
  set off; moving past `dragPx` first lets it go (no pulse, no walk) and becomes a
  look-around drag. No sound and no vibration (Eric). A small gold ring marks your destination until you arrive. As you
  run you leave about three soft white droplets on the squares you leave, fading out in about half a second (yours only).
  All their numbers are in `feel.ts`.
- **One pawn a square, like chess** (`world.ts`): a walk may pass through people, but nobody ends on a square someone
  stands on or is headed for (`taken`: a walker's goal). A free square is its own end; a taken one, a person or a boss
  ends you on the nearest free square beside it (`spotNear`: the 8 squares round it, then the next ring out, and in a
  ring the one fewest steps away), so several people going to one person ring round them; a home ends you on the ring
  round its plot, the Colosseum (or its ground) on the free apron square nearest its gate (`destFor`), so a crowd at the
  gate grows in a half ring. If two walks end on one square, the later claim gives way to the nearest free square
  beside it (`keepApart`, every tick). Bots and bosses pick their ends the same way.
- **Cards** (the prototype's, inside the world's box, over the boss's head or above the home's name, placed every frame;
  a tap anywhere else, or Escape, closes one). A boss: its name and **"Challenge alone"**, which asks **"Leave the town
  square?"** / "You'll fight [boss] alone in Solo Boss Mode." / **Leave** / **Stay**; Leave closes the town square and
  opens the Boss raid screen with that boss's tile picked (`rememberBossPick`, then the screen as the side menu opens
  it); Stay closes the confirm and its card. A home: its name, **"Shop"** greyed (shown, not tappable) and "Coming
  soon". The Colosseum (slice 5): "The Colosseum", **"Raids with people"** greyed and "Coming soon" (Eric's menu for
  raids with people will live there). The boss stays put while its card is open. Tapping something both opens its card
  and walks you next to it.
- **Looking around.** Drag to look
  around; "Back to me" brings the camera back; − / + (and the mouse wheel) zoom. The chips at the box's edge show the
  bosses whose homes are off screen (the nearest few: `maxChips` in `feel.ts`, 4), and the Colosseum's crown when none of
  it is on screen (among the nearest four, it's placed first, so it always shows); a tap glides the camera there. A chip
  never covers a name tag, a home's floating name, the speech bubble, the −/+ and "Back to me" buttons or a nearer
  home's chip: it slides along its edge to the nearest clear spot, and if there's none it isn't shown that frame (the
  tags, names and bubble note their boxes as they're drawn; the chips are placed last, in `placeChips`).
- **Names.** Each home's name is written by the game, never drawn into its art, both ways at once (Eric likes both; each
  one line in `feel.ts` to turn off): floating over the home, landmark style, as you come within a few squares
  (`floatingNames`), and on its sign board in the signs' own pixel capitals (`town/sign-font.ts`: 3 × 5 letters, drawn
  once per size in whole device pixels), whenever its letters would be at least `signMinCap` pixels tall (`signNames`).
  Every board is 24 pixels tall in the art, so every name reads at the zoomed-out view on a phone.
- **The sky by the time of day** (`town/sky.ts`, pure: the hours and the blend; `town/sky-draw.ts`: the drawing). Four
  looks, dawn, day, dusk and night, on the device's clock (read once a minute), each blending into the next over half
  an hour (`skyHours`, `skyBlendMinutes`; first guesses: dawn 5:30, day 7:30, dusk 17:30, night 19:30). Each look
  (`skyLooks` in `feel.ts`) sets the sky's gradient, its horizon color (which the far ground and the haze dissolve
  into, so the edge is one soft line in every look), a tint over the world (one fill a frame; name tags, bubbles and the
  homes' names are drawn after it, so they read as well at night), the sun (the moon at night: craters, stars, a few
  twinkling) and the clouds' colors; dawn adds a morning mist (more haze over the far ground, into its own pale gold) and
  its sun rises on the other side of the sky from dusk's. The prototype's far-band softening (a blurred copy laid over
  the far ground) is off (`softenFarBand`): it ghosted the far squares. The sun and moon sit low over the horizon and shift only a little as you walk round the world.
- **`?sky=dawn|day|dusk|night`** on `/town` holds one look whatever the clock says (for Eric and the tests; nothing else
  reads it).
- **The clouds** are pixel art like the homes (`cloudPixel`): puffs on flat-ish bottoms, each puff shaded as a ball lit
  from the top left, a few sizes and some wisps, spread across the sky with gaps, never on the horizon. Each cloud is
  drawn once per look into a small canvas; a frame only places them (a slow drift and a little parallax).
- **`rimLine`** (`feel.ts`, off): a dark line along the world's rim instead of the haze alone (Eric was curious), with its
  color and width.
- **The chips** show each boss's head (`BOSS_FACE` in `render.ts`: a box in its first idle frame), and the Colosseum's
  a gold crown over the board's squares (`COLISEUM_CHIP`, `houses/coliseum.ts`).
- **The Colosseum** (`town/houses/coliseum.ts`, slice 5; redrawn about twice the size in slice 6): a Roman amphitheater of
  warm stone, chess-themed (checkered bands, a chessboard arena, marble pawns in the middle tier's arches, pieces carved over
  the gate, navy and gold banners, statues of the pieces on plinths round it), 648 × 372 pixels at the homes' scale (twice as
  wide as slice 5's, half as tall again: taller would never fit a computer's view from the park);
  its foot is the gate's sill on its ground's front edge. Its sign is a tablet over the gate. It's drawn like a home
  (frames made once, one image a frame, only when its foot is inside the rim; `drawable`'s `below` lets its top draw
  while its foot is under the box). Past the rim (slice 6) it still stands on the horizon where it lies, up to `farReach`
  squares further, smaller, sunk behind the world's curve and hazy, so it looms from across the world (`drawFarColiseum`;
  not tapped, no chip while it shows). The design and the calls: `docs/decisions/2026-10-26-town-square-slice-5.md` and
  `…-slice-6.md`.

- **The park** (slice 6; `PARK` and `PARK_PLAN` in `world.ts`, the art in `town/houses/park.ts`): 20 × 11 squares in front
  of the Colosseum, past its apron and the walk, laid out as a city park: a paved walk all round, a promenade up the middle from the plaza to the
  gate round a stone fountain in the middle (2 × 2, its water moving), ten chess tables either side of it (`TABLES`: each a
  solid square with a stool west and east, facing each other across it), lawns with trees and benches. The ground has two
  more kinds of square (`groundAt`: paving and grass), drawn with the board's in the same color-sorted fills. Tables, trees,
  benches and the fountain are solid (`walkable`); stools, paths and grass are walked on. Each picture is made once (a
  `FrameCache` per kind) and drawn as one item sorted with the people, a little behind whoever stands on its row.
- **Sitting at a table** (slice 6): a tap on a table or a stool walks you to its free stool nearer you (`destFor`'s
  `table`; both taken: beside it) and opens its card: "Chess table", **"Casual"** and **"Ranked"** greyed, "Coming soon"
  (matchmaking for the park is the next job). A person sits (`seated`) when stopped on a stool meaning to (`Person.sit`:
  always for bots, for you while the table's card is open after a tap on it): drawn from `sitCut` of its height up, resting
  on the stool's seat (`sitSeat`), facing the board, with no shadow of its own. Closing the card (a tap elsewhere) or walking
  on stands you up. Bots head for a free stool now and then (`botSitChance`, `botSitReach`) and may stay a while
  (`botStaySeated`).

- **The statues** (`town/houses/statues.ts`; Oct 26, `docs/decisions/2026-10-26-town-square-statues.md` and
  `-statues-2.md`): the marble statue (the Hidden Boss in stone: his own picture, `RECLUSE`'s idle without the book,
  turned to marble shades by lightness, `bossFigure`) on the gate's left and the bronze statue on its right, each on a
  pedestal about a piece's plinth's size (40 × 24) before the Colosseum ground's end column, drawn by the game over the
  Colosseum's picture (not in it). No name on either. At the world's scale each pedestal's panel carries only a few
  squiggly lines (like writing too small to read).
  Each has its square right in front (`STATUES` in `world.ts`, with its quote) where you stand to look at it; the bots
  never stop there. **Walking up zooms in**: stopping on it (or where a tap on the statue sent you) glides the camera in
  close (`closeGlideMs`) through a longer lens (`mag`, `ox` and `oy` in `camera.ts`; the − / + zoom is untouched), the
  statue whole and as big as fits (where it would reach the − / + and "Back to me" buttons, above them or moved beside
  them, whichever is bigger), the close-up
  drawing (4 times finer, `CLOSE`, made ahead a slice a frame) crossfading in; the people in front of it fade. Once the
  camera arrives the squiggles fade and the quote renders in, line by line, on the pedestal's panel, written at the
  screen's own resolution in the signs' pixel capitals as big as fit (engraved in the marble, cast in the bronze
  plaque; 12.5 px or more on a 360 × 640 phone), and in an off-screen live region (`.town-sr`) for screen readers. A tap
  elsewhere, a drag, a chip, −, + or "Back to me" glides back to the zoom you had and the quote fades.

- **You** (slice 5): your pawn wears your profile's crate items (`town/you-look.ts`: `Avatar` drawn once into a canvas,
  again only when your look changes; plain when signed out or wearing nothing; bots stay plain). Every pawn's base stands
  on its square's middle, with a contact shadow under it that shrinks and fades as the hop lifts it. You have no ring
  under you (Oct 26, Eric: the ring and the shadow together "looks sloppy"); your gold name tag marks you, and your
  shadows are a bot's, sized from the pawn rather than the margin your items are drawn in.

## The feel: `town/feel.ts`

Every number that shapes how it feels is in `TOWN_FEEL`, one line each: the walk (90 ms a square, the hobble), the camera
sets, the zoom, the camera's follow and glide, the drag, the haze, the clouds' parallax, how often bosses roam and talk,
how often bots walk, the sizes, the names, the sky's hours and its four looks' colors, the rim line. The earlier value is
noted wherever a slice changed one.

## Adding a home

1. Draw it in `town/houses/<boss>.ts` like the others (the game's pixel art: `characters/sprite.ts` parts and frames,
   painted with `houses/kit.ts`), about 144 × 120 pixels standing on its foot (a landmark may stand bigger: Hollow Peak
   is taller, Alfil's Pyramid is 208 × 160), with a blank sign board (`signBoard`) and
   an `idle` of a few frames. Export the `Character` and its sign's face (`signFace`).
2. Add it to `HOUSES` in `houses/index.ts`, its boss's sprite to `BOSS_ART` and the box round its head to `BOSS_FACE` in
   `render.ts`, and a `Home` to `HOMES` in `world.ts` (its id, its boss's name, its name, its chip color and its plot's
   middle square, clear of the Colosseum's ground and about 8 to 10 squares from its neighbors).
3. Look at it at real size and at 2× (`npm run preview:characters -- <dir> extra=packages/app/src/town/houses/<boss>.ts
   only=house-<boss> looks=none`), and in the square.

## Files

- `packages/app/src/town/`: `TownPage.tsx` (the lazy load), `Town.tsx` (the screen, the loop, input, chips, cards, the sky's
  clock, the statues' close-up), `press.ts` (a finger as a button), `camera.ts`, `world.ts`, `render.ts`, `you-look.ts`, `sky.ts`, `sky-draw.ts`, `sign-font.ts`, `feel.ts`, `town.css`, `houses/`
  (one file per home, thirteen in all, the Colosseum's `coliseum.ts`, the park's `park.ts`, the kit of shared pieces and the index).
- References: `docs/mockups/town-square/` (the prototype Eric tested, and the pictures for the homes: Eric's for the
  igloo, the peak and the meadow, his suggestions for seven more). Alfil's Pyramid has no picture: it's our design.

## Tests

- `packages/app/test/town-camera.test.ts`: the projection (the focus in the middle column, wrapping both ways, a tap picks
  the square drawn there, far squares shrink, zooming out shows more rows, the phone / computer blend), the layout
  (thirteen homes 8 to 10 squares from their nearest neighbors, none near the start, the Colosseum's ground and the park
  clear, and the start south of it on the park's promenade), the walk around a home, and the eased steps meeting the even ones at the same speed.
- `packages/app/test/town-sky.test.ts`: which look shows when, the looks always adding up to 1 and blending over their
  half hour in order, `?sky=`, and the tint (none by day, softer at dawn than dusk, coolest and darkest at night).
- `packages/app/test/town-world.test.ts`: one pawn a square (a taken square ends you next to it, the end is always free
  tap after tap, a later claim gives way, three bots ring round one spot, a ring fills nearest first); the Colosseum (its
  ground solid and walked round, its apron open, a tap ends you at its gate and a crowd gathers on the apron).
- `packages/app/test/town-press.test.ts`: down presses, up on the same thing walks, a drag cancels, up elsewhere lets go.
- `packages/app/test/town-world.test.ts` also, the park (slice 6): in front of the gate, paving and grass, no home's roaming
  ground on it; ten tables, each solid with two stools facing each other; the fountain in its middle and the solid things
  walked round; a paved way from the plaza past the fountain to the gate, and every stool reachable; a tap on a table ends
  you on its nearer free stool, where you sit (both taken: beside it); bots sit now and then, a stool each.
- `packages/app/test/town-world.test.ts` also: the statues' squares (on the apron, in front of the ground's end columns,
  symmetric), their quotes word for word, a tap on one walks you there (or beside it), the bots never stop there.
- `e2e/town.spec.ts` (phone and desktop; `e2e/areas.json`, "the town square"): the page loads, the world is drawn and
  fills its box, a tap ahead walks you there, the zoom pair works (it opens zoomed out), back goes home; each statue (a
  tap walks you up, the camera zooms in close on it, its quote word for word in the live region, its letters at least 12
  pixels; a tap elsewhere glides back to the zoom you had, zoomed out or in, and clears it); `?sky=day` and
  `?sky=night` draw different skies; a boss's card, its confirm (Stay, then Leave to the Boss raid screen, his tile
  picked); a home's card (Shop greyed, "Coming soon", closed by a tap elsewhere); the Colosseum's (a tap on its gate walks
  you to the apron; "Raids with people" greyed, "Coming soon"); a park table's (slice 6: a tap walks you to a stool and you
sit, its card with "Casual" and "Ranked" greyed and "Coming soon"; a tap elsewhere closes it and you stand). Test hooks: the canvas's `data-you` (your square),
  `data-ready` (a frame is drawn) and `data-sit` ("1" while you sit at a table); with the test switches on, `window.__townAt(kind, id)` (where to tap a boss, a home or
  the Colosseum's gate) and `window.__townGather()` (the three nearest bots come and stand beside you), `window.__townAt("statue", "bronze" | "marble")`, `window.__townAt("table", i)` (a table by its index in `TABLES`) and
  `window.__townCam()` (the zoom, the lens, the focus, the statue up close, whether its quote shows and its letters' size).

## Not built yet

The bottom strip, a bot's or player's card ("Invite to party"), the shop itself, the Colosseum's menu (raids with people,
party), the park's matchmaking (sitting at a table queues you: `ROADMAP.md`, "The park"), quick chats, other people's dressed pawns, the Simple map setting, real players and
rooms, sounds.
