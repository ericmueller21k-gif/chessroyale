# Inside the Colosseum (/colosseum): the first look

A preview (Oct 30, Eric): walk into the Colosseum from the town, watch two bots play on a giant board in the middle of a
full arena, and switch views. The weekly tournament held here comes later (`docs/decisions/2026-10-30-colosseum-look.md`
links Eric's notes); this page is what's built.

## How it works

- **The way in.** The town's Colosseum card keeps what it had (Raids with people, greyed, Coming soon) and adds a link,
  **Look inside (preview)** (`/colosseum`). `App.tsx` mounts `colosseum/ColosseumPage.tsx` at `/colosseum`, which loads the
  rest as its own chunk. **Exit** goes back to the town (`/town`, at its start).
- **The arena** (`colosseum/arena.ts`: the layout and the camera's math, pure; `arena-gl.ts`: WebGL 2). Meters, a board
  square a meter: the board in the middle on a stone plinth, sand to the arena wall (2.6 m, 24 arches, 8 crown banners),
  14 rows of stone steps with a landing after the seventh and 8 aisles of stairs, the gallery wall with arches and 12 banners
  at the top, six pillars with torches and two statues (a stone pawn in a gladiator's helm, never the town's bronze statue)
  on the floor, half-way between the seats' angles so none stands between a seat and the board.
- **The views.** Eight seats round the stands, each at its own angle, lower and higher (rows 1 to 9), each lens set so the
  board takes about 80% of its height (the middle third of the view, as Eric's mockup); and two player views, 6 m (about 20 feet) above the board behind White's end and
  Black's (`?view=white`, `?view=black`, anyone's). The page opens at a random seat; **Change seat** picks another of the
  eight at random. Drag (or swipe) the arena to turn your view a little: never so far the board's middle leaves the screen
  (`turnLimits`). On a computer the lens is shifted so the board sits in the middle of what the overlay leaves.
- **The crowd.** Every seat filled (about 2,100 people): the town's pawns in their tints, pawns in crate items seeded the
  way every bot's look is (`botLook`), the town's bots in their own looks, the bosses' sidekicks (about 6%) and now and then a
  boss (about 1%, never just in front of a view's seat). One instanced draw call, uploaded once; each turns round its
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
- **The 3D pieces (a switch for now: `?pieces=3d`, anyone's; Eric decides after the stills).** The board's own cburnett
  pieces made 3D once in code at load (`colosseum/pieces3d.ts`), chunky like the town's table pieces: each follows its
  picture's outline and proportions; pawn, rook, bishop (its slit), queen (her points) and king (his cross) turned in ten
  steps round, the knight the cburnett horse's head extruded with a bevel on a round base. Two flat tones a face from
  `TABLE_INK` and a thick dark outline (an inverted hull baked into each mesh), no shine, a soft round shadow under each.
  Each turns round its own axis to face you, as the flat pieces did (a knight always shows its profile). One draw call a kind
  on the board (up to 9 a frame), the instances written only when a move is made. Without the switch, the flat pieces exactly
  as before. Decision: `docs/decisions/2026-10-30-colosseum-3d-pieces.md`.
- **The overlay** (HTML over the arena, as Eric's mockup; on a phone the bar has no title: Exit, Change seat and the gear): each player's card (portrait, name with "(bot)", ELO, the pieces
  taken, the clock: lit gold for the side to move, tenths under 20 s), the middle (Turn N, the viewers: the crowd's size,
  "2.1K"), the last four moves (the one just played in gold), the flat board (the game's `Board`, small, silent; Black's
  player view turns it round) with its eval bar ("+0.3", "M3"), a status line ("Game 2 · 3+2", then "White wins on time.
  Next game soon."), the chat's box (empty for now: "Coming soon"), and in the top bar Exit, Change seat and the gear
  (`MatchMenu` with `extra`: Sound, Animations, **Ambient crowd noise** (a switch only, remembered on this device; no
  sound yet), Report a bug). Phone (under 900 × 600): the stands at the top (31% of the height), the cards, the moves in
  one line, the board, the chat below. Computer: the arena fills the screen, the cards and moves along its top, the board
  and the chat down its right. Every box keeps its size and place.
- **No WebGL 2:** a still of the stands (`colosseum/still.jpg`) in the arena's place; everything else the same.
- **The frame rate.** Three draw calls a frame (the arena, the crowd, the props). A frame sets the camera, the time and the
  jump's clock and draws: nothing allocated, nothing uploaded (the props are uploaded again only when a move is made). The
  loop stops while the tab is hidden. `?fps` shows a pill: frames a second and draw calls. Measured (eric.md's method,
  headless, software WebGL): phone 7.1 fps, computer 3.9 fps (SwiftShader's fill), the main thread's script 0.44 and
  0.77 ms a frame, 3 draw calls; numbers in the decision note.
- **The town is untouched** but for the card's link: none of this loads there, and the town's drawing and frame loop
  are as they were.

## Placeholder art

Every picture is made in `colosseum/art.ts`, one maker per role (its table lists them): the API art
(`claude/colosseum-art`, `scripts/boss-art/out/arena-*`) replaces them one at a time. Placeholders now: the wall's and
the gallery's arch slices, the crown banner, the sand, the stone colors, the pillars (geometry) and their flame, the
giant pieces (the board's cburnett pieces, Black's in slate; 3D behind `?pieces=3d`), the statue, and the crowd's pictures (the town's own). Not
drawn yet: the railing in front of your seat, pawn backs (done by the shader), far-crowd figures (mipmaps do it).

## Files

`packages/app/src/colosseum/`: `ColosseumPage.tsx` (the lazy page), `Colosseum.tsx` (the screen, the loop, the hooks),
`arena.ts`, `arena-gl.ts`, `art.ts`, `pieces3d.ts`, `match.ts`, `floor-engine.ts`, `colosseum.css`, `still.jpg`. The link:
`town/Town.tsx` (the card), `town/TownPage.tsx`, `town/town.css` (`a.town-btn.town-look`). The gear's extra rows:
`components/MatchMenu.tsx` (`extra`, `SwitchRow`).

## Tests

- `packages/app/test/colosseum.test.ts`: the seats and aisles, the ten views (eight angles, lower and higher; the player
  views 6 m up), no pillar or statue between a seat and the board, the whole board in every view turned as far as it may
  go (phone and computer), Change seat never the same seat, a move's pieces (slide, capture, castling, en passant), the
  overlay's words, a game played to its end and the next one started, a flag.
- `e2e/colosseum.spec.ts` (phone and computer): the card's link in, the arena drawn (WebGL, three draw calls, the crowd
  in), Change seat changes the view, a bot game plays and, ended, the next starts, the overlay's pieces, the gear's rows,
  `?view=black`, Exit back to the town.
- `packages/app/test/colosseum.test.ts`, "the 3D pieces": the six meshes (whole triangles facing the right way for culling,
  unit normals, each with its outline, on the board, inside their squares, the king tallest). `e2e/colosseum.spec.ts`, "the 3D pieces behind ?pieces=3d": drawn, nine draw calls at the
  start, the game plays; without the switch, flat and three.
- Test hooks (test switches on): `window.__colosseum` (`state()` (with `pieces`: "flat" or "3d"), `seat(i)`, `flag()`,
  `jump()`, `sample()`, and for still pairs `pieces(style)`, `freeze()` and `pose(fen)`: the same frame in 3D and flat), and
  `?fast` makes the bots move at once and the next game come in 1.2 s.

## Not built yet

The tournament (registration, Swiss pairing, the server's games, the featured boards, standings); the chat in the box;
crowd noise and sounds; real players' pawns and the viewer count from the server; the two players' pawns on the floor;
the API art; a GPU-side far-crowd simplification if real phones need it.
