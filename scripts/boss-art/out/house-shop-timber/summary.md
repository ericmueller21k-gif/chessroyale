# Boss art: house-shop-timber

- Model claude-opus-5-5, effort high, adaptive thinking. 35 turns, 22 renders.
- Spend: **$5.05** of the $10 cap (74 input, 309,020 cache-write, 6,398,080 cache-read, 111,069 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-timber/house-shop-timber.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:42
  const data = new Uint8ClampedArray(w * h * 4);
               ^

RangeError: Array buffer allocation failed
    at new ArrayBuffer (<anonymous>)
    at new Uint8ClampedArray (<anonymous>)
    at blank (/home/user/chessroyale/scripts/preview-characters.ts:42:16)
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:326:17)

Node.js v22.23.4
. Each look it took: scripts/boss-art/out/house-shop-timber/looks/.

## Its notes

I've drawn Timber's shop in scripts/boss-art/out/house-shop-timber/house-shop-timber.ts and checked every piece and animation by render: at 4x, on dark and light backgrounds, and the whole room at 1x. The only render warning left is that the full-room pictures have a pixel on their edge, which is expected. I haven't compiled it with TypeScript, loaded it in the game, or seen the lights and pools working.

THE ROOM
- Floor: wide honey planks running north to south, two to a square, with soft broken grain and the odd knot (floor-c) or shavings and sawdust (floor-d). Daylight spills onto the two squares in front of the door (floor-door). It tiles with no seams and stays calm at 4x. One thing you may notice: the end joints fall into a fairly regular brick-like pattern.
- Back wall (wall, wall-b): a squared beam over big windows between log posts. Through them: sky, far hills, a pine forest and a blue river. wall-b has a beaver dam on the river.
- Side walls: lap boards with tools hung on pegs. There are three versions (a hand saw; a level, chisels and a mallet; an axe and yellow rope) plus a log post.
- Front: a low wall of two stacked logs (hem, hem-pillar). The entrance has log posts and a lintel with Timber's spare orange hard hat hung over it. The plank door stands wide open, and through it you see daylight, pines and a path. It clearly reads as the way out.
- Behind the counter (backdrop): on the left, varnished shelves of polished boards, small glossy chess pieces and a live-edge slab. On the right, a rack of tall raw planks and stacked raw boards. A two-man crosscut saw hangs above, with a lantern on each side.
- Counter: a varnished workbench on raw-wood legs, with a steel vise and a blank plaque. The bench is 30 px tall, so Rivet shows over it.
- Crate (idle: 6 frames, 220 ms): raw planks with two orange buckled straps, two big beaver teeth stenciled on the front and a red-handled hammer lying on the lid. A glint runs along the lid, then winks on the hammer head.

THE BATTLE CIRCLE
- An octagon of polished end grain from a giant sawn log. The growth rings turn from round to octagonal toward the edge, inside a pale sapwood ring and a cracked bark border.
- The emblem in the middle is a red-handled hammer crossed over a hand saw, on a dark varnished disc ringed in Timber's yellow.
- Start marks are round brand-marks on the middle line: the boss's (west, column 8) is orange with a hard hat, yours (east, column 11) is yellow with a pawn. There's no middle line.
- How it's tiled: 13 tiles for the north-west quarter (circle-i-j) are rotated to make the other quarters. The rings are built from the angle so the quarters meet with no seam. The 8 slanted-edge squares, 4 mark squares and 4 emblem squares are drawn where they lie, so the floor planks around them run the right way.

CHESS PIECES
- Finished: a big king (72 px, two squares), a queen with a five-point coronet (64 px) and a knight (46 px). All are glossy varnish with a streak of shine.
- A low display table holds a small king, queen, bishop, rook and two pawns.
- FOR SALE lawn signs stand beside the king and queen, beside the knight, and on the display table. Each is a white post with an arm and a hanging board: "FOR" in white on red over "SALE" in red on white, in 3x5 pixel letters. They read clearly at 3–4x.
- Unfinished (carving-rough): a rook half-carved from the top of a log with the bark still on, a rough pawn blank with chisel marks, a chisel and mallet set down, and shavings.

THE SHOWPIECE: the giant king being carved (showpiece; 4x2 squares, 10 frames at 110 ms)
- A 112 px king on a low plank dais. Its crown and body are already shaped in fresh raw wood, with pencil guide lines. Its foot is still the barked log it's being cut from, with rough chisel cuts where they meet. A blueprint of the king stands on an easel, a caddy of red-handled chisels sits on the dais, and shavings lie around.
- The loop, frame by frame:
  1. Frames 0–2: the mallet hovers, then draws back.
  2. Frame 3: it swings in.
  3. Frame 4: it strikes; the chisel bites in a pixel and dust puffs.
  4. Frames 5–8: five chips arc out and fall, while the mallet eases back.
  5. Frame 9: rest, which flows straight into frame 0.
  One tap per loop: lively but calm.
- Why I picked it: one strike is a big motion that still reads at the town's scale. It also tells the shop's story in one object, a raw log becoming a finished piece, which links the raw and varnished woods Eric asked for. A lathe's spin is too subtle in pixels.

PROPS AND LIGHTS
- Lumber: two plank stacks tied with yellow rope, a log pile stacked three-two-one, a sawhorse with a saw in a board and sawdust under it, a chopping block with a red-handled axe, a yellow toolbox.
- Stove (6 frames, 140 ms): a black pot-belly stove whose fire flickers behind the grate.
- SHOP_TIMBER_LIGHTS: the stove's fire and the two backdrop lanterns. SHOP_TIMBER_POOLS: a pool in front of the stove and one along the backdrop. Each entry has a `piece` field.

LAYOUT (column, row)
- Counter at columns 8–11, row 3, with the crate on it.
- West: stove (2,3), plank stack (4–5, 2), king (2,8), queen (3,8), sign (4,8), knight (2,11), sign (3,11), display table (2–3, 14), log pile (1–2, 17), chopping block (4,17).
- East: showpiece (columns 15–18, rows 3–4), unfinished pieces (15–16, 8), sawhorse (15–16, 12), toolbox (17,15), plank stack (15–16, 17).
- Columns 8–11 are clear from the door (columns 9–10, row 19) to the counter, and nothing stands on the circle.

SIZES (px; squares)
- Floor and circle tiles: 37x37; 1x1.
- wall, wall-b, wall-side, wall-side-b, wall-side-c: 37x130; 1 square each.
- wall-pillar, wall-side-pillar, hem-pillar: 37x150; 1 square each.
- hem: 37x24; 1 square.
- entrance: 74x112; 2x1.
- backdrop: 148x150; 4x1.
- counter: 148x46 (the bench itself 30 tall); 4x1.
- crate: 32x28; sits on the counter.
- king-big 40x78, queen-big 40x70, knight-big 40x52, sale-sign 30x40: 1 square each.
- display-table 74x64, carving-rough 74x70: 2x1 each.
- showpiece: 148x182; 4x2.
- plank-stack 74x44, log-pile 74x58, sawhorse 74x52: 2x1 each.
- chopping-block 40x52, toolbox 36x40, stove 40x96: 1 square each.

EXPORTS
SHOP_TIMBER_PIECES, SHOP_TIMBER_LAYOUT, HOUSE_SHOP_TIMBER (id "house-shop-timber"), SHOP_TIMBER_COUNTER_SIGN, SHOP_TIMBER_CRATE_AT, SHOP_TIMBER_MARKS = { boss: [8, 10.5], you: [11, 10.5] }, SHOP_TIMBER_LIGHTS, SHOP_TIMBER_POOLS. The ShopPlace type is also exported.

HOUSE_SHOP_TIMBER has one viewing animation per piece, except the circle tiles, which are shown together in review-circle. It also has review-floor, review-props, review-props-2, room-live and strip views.

CHOICES YOU MIGHT WANT TO CHANGE
- The showpiece is 4x2 squares, not the suggested 3x2, so the mallet's swing fits.
- I added a stove as the main light source, and a third side-wall version.
- The circle uses 29 tile pieces (13 rotated, 16 drawn in place) rather than a few repeated ones.
- The middle of the east side, around columns 17–18 and rows 9–11, is a little sparse.
- The pieces on the display table are simple shapes at that size.
- The stove pipe stops at a small cap instead of reaching a ceiling.
