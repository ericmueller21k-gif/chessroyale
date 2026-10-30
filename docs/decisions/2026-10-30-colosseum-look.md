# Inside the Colosseum: the first look (Oct 30, 2026)

## Eric's words (Oct 30)

A weekly tournament held inside the Colosseum (the town's every room leads to the same one), spectated from the stands:
"a real Colosseum interior", your pawn squeezed among other players, bosses scattered, your seat one of about 8
viewpoints ("Change seat" gives a random one), the crowd jumping when a queen is captured, each a little differently. Two
more views for the players: "as if a real board was in front of you … about 20 feet above the board, in line with your
side". Today: "enter the Colosseum on the live site and switch the views", seats filled with bosses and bots, a bot
game on the floor. His mockup: a seat behind the heads of the row in front, tiered stands, crown banners, torches on
pillars, a statue, the giant board; the cards, the turn, the viewers, the moves and a flat board with its eval bar over it.

## What was built

The arena and its views with bots playing on the floor, and the overlay, behind the town card's "Look inside (preview)"
(`docs/areas/colosseum.md`). The tournament itself (pairing, the server's games, registration) is not built.

## Judgment calls

- **Its own WebGL 2 renderer beside paint-gl.ts, not on it.** paint-gl.ts stands in for a 2D canvas: flat, no depth
  buffer, the frame recorded call by call each frame. The arena is a 3D place seen from ten spots, two thousand people in
  it: one static mesh (one draw call), the crowd as instances uploaded once (one draw call), the props as instances
  uploaded per move (one draw call). Three draw calls; a frame sets a few uniforms. About 600 lines, no library.
- **Billboards, not 3D models.** Every figure is the town's own picture, standing upright and turning round its own axis to
  face you (as the town's pawns face the camera). The API art will be pictures too (the town's sprite format), so the same
  path takes it.
- **Seen from behind:** no item has back art, so whoever faces away from you is their own picture mirrored and darkened
  toward a shadow (in the shader, smoothly by the angle): the rows in front of your seat read as heads and hats from
  behind, as in the mockup, with no face looking back at you.
- **Pillars between the seats' angles.** The eight seats sit at the eight compass angles; the pillars and the two statues
  at the eight angles half-way between, so none stands between a seat and the board (tested). No boss sits within 5 m of a
  view's seat (a big figure there hid the board).
- **"Change seat" picks another of the eight** at random (never the same one). The player views are a switch in the
  address, `?view=white` / `?view=black`, anyone's (the site is behind Cloudflare Access), as the brief asked "for now".
- **Drag limits:** the board's middle may move no further from the screen's middle than the lens's half-size less the
  board's own angular half-size (at least a quarter of the half-size, so a close seat can still look round).
- **The game on the device:** this screen's own Stockfish worker (not the game's pool, which isn't warmed here), started
  with the screen and ended with it; the bots are the town's 1300 and up (Stockfish's UCI_Elo floor is 1320), at their
  ratings; the eval at 12,000 nodes. The floor's numbers (3+2, the pause, the nodes) are in `match.ts` (`FLOOR`), not
  settings.ts: a preview, to be replaced by the server's games.
- **The eval number** comes from the engine's expected score (win/draw/loss), turned into pawns with Lichess's curve
  ("+0.3"), mates as "M3".
- **Viewers** show the crowd's size (about 2.1K) until the server counts real ones.
- **The chat's box is there and empty** ("Coming soon"): the town chat is tied to the town's map (its modes, its move-
  anywhere box, its tone from the town's sky), so reusing it is more than a simple drop-in.
- **The gear** is the match's (`MatchMenu`) with a screen's own rows added (`extra`): Sound, Animations (which also turns
  the crowd's jump off), Ambient crowd noise (a switch only, remembered on this device), Report a bug. No Leave row: Exit
  is in the bar.
- **No WebGL 2:** a still of the stands from the eighth seat (315°, row 11) of this build (`still.jpg`, 140 kB, loaded only then).

- **After the director's notes on the first stills (Oct 30):** the seats lower and closer (rows 1 to 9) and each lens
  narrower, so the board fills about the middle third of the view; of the rows in front of your seat only the one just in
  front is drawn, smaller and lower (the tops of heads); the giant pieces sized to their squares; on a phone no title in
  the bar.

## Frame rate (eric.md's method)

Headless, a phone 390 × 844 (3x, the canvas capped at 2x) and a computer 1440 × 900, 5 s at a seat (the second) while the
bots play, the medians of four runs taken in turn, one pass. This machine has no GPU: WebGL here is SwiftShader (the CPU
pretending to be a GPU), so the fps are its fill, as the town's WebGL numbers were (4 to 6 fps there).

| | fps (runs) | median fps | script a frame | all main-thread work a frame | draw calls a frame |
| --- | --- | --- | --- | --- | --- |
| phone 390 × 844 | 7.1, 6.7, 7.2, 7.6 | 7.1 | 0.44 ms | 5.0 ms | 3 |
| computer 1440 × 900 | 4.3, 3.2, 4.2, 3.7 | 3.9 | 0.77 ms | 9.0 ms | 3 |

The script a frame (under a millisecond, the overlay's clocks included) is what the page itself costs; the rest is the
software GPU. On a real GPU three draw calls of this size are well under a millisecond. Eric's phone and laptop decide.

The town is unchanged: no town spec edited, its drawing and frame loop untouched (only the card's link and its style).
Its lazy chunk now shares render.ts and the art it imports with this page's chunk (the same code, in two files).
