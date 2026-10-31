# Inside the Colosseum (/colosseum): the first look

A preview (Oct 30, Eric): walk into the Colosseum from the town, watch two bots play on a giant board in the middle of a
full arena, and switch views. The weekly tournament held here comes later (`docs/decisions/2026-10-30-colosseum-look.md`
links Eric's notes); this page is what's built.

## How it works

- **The way in.** The town's Colosseum card keeps what it had (Raids with people, greyed, Coming soon) and adds a link,
  **Look inside (preview)** (`/colosseum`). `App.tsx` mounts `colosseum/ColosseumPage.tsx` at `/colosseum`, which loads the
  rest as its own chunk. **Exit** goes back to the town (`/town`, at its start).
- **The arena** (`colosseum/arena.ts`: the layout and the camera's math, pure; `arena-gl.ts`: WebGL 2). Meters, a board
  square a meter: the board in the middle on its stone border, a floor of pale flags to the arena wall (2.6 m, 24 arches, 8
  crown banners), 14 rows of stone benches with a landing after the seventh and 8 aisles of stairs, the gallery wall with
  arches and 12 banners at the top, six torch pillars and two statues (a marble pawn champion with a helm, a round shield
  and a short sword, on its plinth: generic, never the town's bronze statue) by the wall, half-way between the seats'
  angles; close enough to the wall that none hides any of the board from any view (tested).
- **The views.** Eight seats round the stands, each at its own angle, lower and higher (rows 1 to 9), each lens set so the
  board takes about 80% of its height (the middle third of the view, as Eric's mockup), the stone railing in front of you
  along the view's foot; and two player views, 6 m (about 20 feet) above the board behind White's end and
  Black's (`?view=white`, `?view=black`, anyone's). The page opens at a random seat; **Change seat** picks another of the
  eight at random. Drag (or swipe) the arena to turn your view a little: never so far the board's middle leaves the screen
  (`turnLimits`), and in a seat never so far up the board's squares reach the railing (`railPitch`). On a computer the lens
  is shifted so the board sits in the middle of what the overlay leaves.
- **The crowd.** Every seat filled (about 2,100 people): the town's pawns in their tints, pawns in crate items seeded the
  way every bot's look is (`botLook`), the town's pawn bots in their own looks. **The bosses** (Eric, Oct 30): every boss with a
  sidekick sits exactly once, across two seats with its sidekick in the next, in rows 1 to 3, spread round the ring, at seats
  that never change (`arena.ts` `bossSeats`: the same in every view and on every load), never where one would cover the board
  from any of the ten views (`coversBoard`); bosses stand 1.4 m (1.15 before), sidekicks as they were; no other boss or
  sidekick in the stands, and never the Hidden Boss. Everyone sits a little into the bench (a quarter of a pawn's height:
  arena-stands' seat points sink a pawn into the bench in front), and each seat lies on a seat mark of the benches. One
  instanced draw call, uploaded once (the torch pillars, the statues and the banners ride in it); each turns round its
  upright axis to face you. **Seen from behind** (the rows in front of your seat): no item has back art, so a person
  whose front faces away from you is drawn as its own picture mirrored and darkened toward a shadow; hats and outlines
  read, no face looks back at you. Of the rows below your seat only the one just in front is drawn, smaller and a
  little lower (the tops of heads, as the mockup); the rows under it aren't, so they don't cover the arena. Your own seat
  is left empty. No names; nothing in the arena takes a tap.
- **The jump.** A queen captured: the crowd jumps twice, each person with its own delay (up to 0.35 s) and height (0.12 to
  0.32 m), worked out on the GPU from one uniform. Not under reduced motion or with Animations off (the gear).
- **The game on the floor** (`colosseum/match.ts`, `floor-engine.ts`). Two town bots rated 1300 and up (Stockfish's
  UCI_Elo starts at 1320) play 3+2 on this device: this screen's own Stockfish worker, started when it opens and ended when
  it closes, plays each bot at its rating and gives the eval bar its number (12,000 nodes). A bot thinks 0.4 to 5 s a
  move (less when its clock runs low). Mate, a draw by the rules, a flag or 240 plies ends a game; the next starts 5 s
  later with two other bots. The big pieces slide (0.45 s, a little hop), a captured one goes as the slide lands. No
  engine (it failed to load): random legal moves, no eval.
- **The 3D pieces (the gear's "3D pieces", Eric, Oct 30: "a toggle … for 3D vs 2D pieces players can choose"; Off by
  default, remembered on this device, flipping it redraws at once).** The six Staunton pieces made
  once in code at load (`colosseum/pieces3d.ts`): pawn, rook (six merlons), bishop (its slit cut in the shader), queen (nine
  gold points), king (a gold cross) turned from profiles; the knight a horse's-head outline extruded with a bevel, on the same
  base. Ivory and ebony with a gold trim line, lit from the arena's sun with a soft fill and a little shine, a soft round
  shadow under each. Each turns round its own axis to face you, as the flat pieces did (a knight always shows its profile).
  One draw call a kind on the board (8 a frame with the arena's and the crowd's; the props' call has nothing left to draw), the instances written only when a move is made; the 3D set is built
  the first time it's switched on. Off, the flat pieces exactly as before. Decision: `docs/decisions/2026-10-30-colosseum-3d-pieces.md`.
- **The overlay** (HTML over the arena, as Eric's mockup; on a phone the bar has no title: Exit, Change seat and the gear): each player's card (portrait, name with "(bot)", ELO, the pieces
  taken, the clock: lit gold for the side to move, tenths under 20 s), the middle (Turn N, the viewers: the crowd's size,
  "2.1K"), the last four moves (the one just played in gold), the flat board (the game's `Board`, small, silent; Black's
  player view turns it round) with its eval bar ("+0.3", "M3"), a status line ("Game 2 · 3+2", then "White wins on time.
  Next game soon."), the chat's box (empty for now: "Coming soon"), and in the top bar Exit, Change seat and the gear
  (`MatchMenu` with `extra`: Sound, Animations, **3D pieces** (Off by default, remembered on this device), **Ambient crowd noise** (On by default, remembered on this device:
  the sound below), Report a bug). Phone (under 900 × 600): the stands at the top (31% of the height), the cards, the moves in
  one line, the board, the chat below. Computer: the arena fills the screen, the cards and moves along its top, the board
  and the chat down its right. Every box keeps its size and place.
- **Sound** (Eric, Oct 31; `docs/decisions/2026-10-31-colosseum-sound.md`). `colosseum/ambient.ts`:
  - **The ambience** is Eric's hour of gladiator arena ambience (`sounds/colosseum/ambient.mp3`). It plays while the gear's
    Ambient crowd noise and the game's Sound are both on and the tab shows.
  - **How it's made:** `scripts/crowd-sounds.py` tames the clangs (a fast compressor above 2 kHz, a -5 dB high shelf),
    mixes it to mono at 22.05 kHz and encodes it at 40 kb/s CBR, about 18 MB. Its average sits 15 dB under a move.
  - **How it streams:** an `<audio>` element, so only what plays is downloaded, by Range requests. The service worker
    neither precaches nor answers for it (`STREAMED` in `sw-template.js`).
  - **Who answers the Range requests:** the Worker (`packages/server/src/ranged.ts`). Cloudflare's asset server sends a
    file whole and without its length, so the path is in `run_worker_first`. The Worker asks for the whole file and
    passes on only the asked-for bytes as a 206, reading only as far as the range's end. The file's size is in
    `RANGED_ASSETS`, and a test checks it against the file.
  - **How it plays:** it starts at a random point in the hour (a `#t=` media fragment, with a seek as a fallback) and
    loops at the end. Its level goes through Web Audio (`mediaGain` in `sound.ts`: through the master, with a 1 s fade
    in and out), since iOS ignores an element's volume. If the browser won't start it before a tap, it starts on the
    next tap or key.
  - **The cheer:** a queen taken plays the crowd's cheer (`sounds/colosseum/cheer.mp3`, Quendel's CC BY 4.0 cheering with
    CC0 applause) as the piece lands, with the jump. It is under the game's Sound, not the ambient switch, and is
    fetched when the screen opens (`warmFile`).
  - **Credits:** the cheer is credited in Settings, the FAQ and `/licenses/third-party.txt`; both files are in
    `sounds/colosseum/CREDITS.md`.
  - **Not on the frame loop:** none of this runs per frame, so the frame budget is unchanged.
- **No WebGL 2:** a still of the stands (`colosseum/still.jpg`, the eighth seat, retaken with the API art) in the arena's
  place; everything else the same.
- **The frame rate.** Three draw calls a frame (the arena, the crowd with the arena's figures, the props). A frame sets the
  camera, the time and the jump's clock and draws: nothing allocated, nothing uploaded (the props are uploaded again only
  when a move is made; the flames' flicker and the banners' sway are frames picked on the GPU from the clock). The loop
  stops while the tab is hidden. `?fps` shows a pill: frames a second and draw calls. Measured with the API art (Oct 31,
  eric.md's method, headless, software WebGL, against main): phone 12.7 → 12.9 fps, computer 6.8 → 7.6 fps, script a frame
  0.29 → 0.36 and 0.37 → 0.33 ms, 3 draw calls; numbers in `docs/decisions/2026-10-31-colosseum-api-art.md`.
- **The town is untouched** but for the card's link: none of this loads there, and the town's drawing and frame loop
  are as they were.

## The art

Every picture is made in `colosseum/art.ts`, one maker per role (its table lists them). Since Oct 31 the arena's own
pictures are the API run's drawings, each a `Character` in the sprite format, drawn once at whole-pixel scales and
magnified nearest-neighbor: the wall's and the gallery's arches (`arena-wall`), the benches (`arena-stands`, its seat
points setting where and how low the crowd sits), the torch pillars (`arena-pillar`, the flame on its 5 frames), the banners
(`arena-banner`, swaying on its 6), the floor and the board's border (`arena-floor`: `floor`, `side`, `corner`; the border
flush with the squares, so it never hides a square from a low seat), the statue (`arena-statue`) and the railing in front
of your seat (`arena-railing`, a 32 px strip along the arena's foot in the seats' views, under the overlay, taking no taps).
**Where they came from:** `colosseum/sprites/arena-*.ts` are copied from `scripts/boss-art/out/arena-<id>/arena-<id>.ts` on
the branch `claude/colosseum-art` (commit `f3d56f8a`; the report `scripts/boss-art/out/arena-report.md` there), only their
imports changed. Not used: `arena-pieces` and `arena-pieces-2` (Eric: the giant pieces stay the game's basic pieces, the
board's cburnett, Black's in slate, or the gear's 3D pieces), and `arena-crowd-back` (its plain pawns from behind would
drop the crowd's crate items up close; the backs stay each pawn's own picture mirrored and darkened, the far crowd the
same pictures made smaller by mipmaps). Still placeholders: the board's squares (the town's colors) and the sky.

## Files

`packages/app/src/colosseum/`: `ColosseumPage.tsx` (the lazy page), `Colosseum.tsx` (the screen, the loop, the hooks),
`arena.ts`, `arena-gl.ts`, `art.ts`, `sprites/` (the API art's drawings), `pieces3d.ts`, `match.ts`, `floor-engine.ts`, `ambient.ts` (the streamed ambience),
`colosseum.css`, `still.jpg`. Sound: `packages/app/public/sounds/colosseum/` (`ambient.mp3`, `cheer.mp3`, `CREDITS.md`),
made by `scripts/crowd-sounds.py`; `sound.ts` (`colosseumCheer`, `warmFile`, `mediaGain`). The link:
`town/Town.tsx` (the card), `town/TownPage.tsx`, `town/town.css` (`a.town-btn.town-look`). The gear's extra rows:
`components/MatchMenu.tsx` (`extra`, `SwitchRow`).

## Tests

- `packages/app/test/colosseum.test.ts`: the bosses in the crowd (each with a sidekick once, side by side, rows 1 to 3, the
  same seats every build, none covering the board), the seats and aisles, the ten views (eight angles, lower and higher; the player
  views 6 m up), no pillar or statue between a seat and the board, and none hiding any of the board from any view, the
  railing never over the board (each seat at rest, turned either way and looking up as far as it may; phone and computer),
  the whole board in every view turned as far as it may go (phone and computer), Change seat never the same seat, a move's pieces (slide, capture, castling, en passant), the
  overlay's words, a game played to its end and the next one started, a flag.
- `e2e/colosseum.spec.ts` (phone and computer): the card's link in, the arena drawn (WebGL, three draw calls, the crowd
  in), Change seat changes the view, the railing at the arena's foot (never over the flat board, the eval bar, the chat or
  Exit; no taps; none in a player view), a bot game plays and, ended, the next starts, the overlay's pieces, the gear's rows,
  `?view=black`, Exit back to the town.
- `packages/app/test/colosseum.test.ts`, "the 3D pieces": the six meshes (whole triangles, unit normals, on the board, inside
  their squares, the king tallest). `e2e/colosseum.spec.ts`, "the gear's 3D pieces": Off by default (three draw calls), the row
  flips it at once (eight), the game plays, a reload keeps it, Off again flat and three.
- Sound: `e2e/colosseum.spec.ts`, "sound: the gear's Ambient crowd noise…" (phone and computer):
  - On by default, the ambience plays from a non-zero point in the hour and keeps going, fetched by Range requests.
  - Off pauses it; on plays it again.
  - `jump()` logs the cheer (`colosseumCheer:running` in `__soundLog`).
  
  `packages/app/test/colosseum-sounds.test.ts`:
  - The hour is mono, 22.05 kHz, 40 kb/s CBR, has no cover image and is under 25 MiB.
  - The service worker leaves it alone.
  - The cheer's credit is in Settings, the FAQ and the notice.
- Test hooks (test switches on): `window.__colosseum` (`state()` (with `pieces`: "flat" or "3d"; `ambient`: playing, time, start), `seat(i)`, `flag()`,
  `jump()` (the crowd's jump and its cheer), `sample()`, `pieces(style)` and `freeze()` for still pairs: the same frame in 3D and flat), and
  `?fast` makes the bots move at once and the next game come in 1.2 s.

## Not built yet

The tournament (registration, Swiss pairing, the server's games, the featured boards, standings); the chat in the box;
more crowd reactions (a gasp, a boo); real players' pawns and the viewer count from the server; the two players' pawns on the floor;
a GPU-side far-crowd simplification if real phones need it.
