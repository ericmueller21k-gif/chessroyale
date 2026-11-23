# Boss art: shop-birdie-interior

- Effort high, adaptive thinking. 25 turns, 17 renders.
- Spend: **$3.34** of the $6 cap (54 input, 196,445 cache-write, 2,358,318 cache-read, 94,294 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/shop-birdie-interior/shop-birdie-interior.ts.
- Previews: scripts/boss-art/out/shop-birdie-interior/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/shop-birdie-interior/looks/.

## Its notes

Birdie's station lobby is drawn in scripts/boss-art/out/shop-birdie-interior/shop-birdie-interior.ts. It's a room, so the boss animations the render tool lists (entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory) don't exist. I couldn't open the Battle Tower lobby, Big Boy's shop or room.ts, so ShopPlace ({piece, col, row, w?, d?, rot?, exit?, solid?}) and SHOP_BIRDIE_CAM ({cx:5, cy:4.6, zoom:1, fixed:true}) are my guesses; please check them against the game's types.

How I checked: I looked at the room's idle (frames 0, 4, 6, 7 and 10) at phone size beside the tiger. I looked closely at the board, the arch's train frames, the floor tiles side by side, the seats, counter, stool, back-view chair, crossing post, doors, crossing, shrub and plant. The plain wall, pilaster, east arch, lamp, sconce, hem, table, front-view chair and second shrub I only saw at room size, which reads fine.

Idle (12 frames at 500 ms, 6 s loop):
- Board: frames 0–2 show set A. In frames 3, 4 and 5 the rows flip to set B one at a time, top row first. A flipping flap shows the new picture's top, the old top half falling (squashed, a lighter grey, with a dark edge) and the old bottom half. Frames 6–8 show set B, and in frames 9–11 the rows flip back in turn, so the loop has no jump.
- West arch: Birdie's train (seen from behind: yellow, dark roof, red stripe, tail lamps) is at the platform in frame 6. It shrinks along the middle track over frames 7–10 and is gone by frame 11. Everything else stays still.

Choices you might want to change:
1. Train direction: it pulls away down the middle track and gets smaller, rather than sliding left to right, so it reads as moving away from the room. Only the west arch (`arch`) has it; `arch-east` is the same view with no train.
2. Second lamp: moved from (5,7) to (8,6) so the crossing holds nothing extra.
3. Crossing posts: at (3,7) and (6,7), the crossing's south-west and south-east corners. At (3,4) the post stood up over the seats.
4. Stool on the crossing: the stool at (6,4) stands on the crossing, because the brief puts both the stools and the crossing there.
5. Café chairs: at (4,4) and (4,6) as written, so they sit under the west half of the 2-wide table. Moving the table or the chairs is one number.
6. Chair names: `cafe-chair` (facing south, no é) and `cafe-chair-n` (back view, facing north). The second shrub is `shrub-b`.
7. Wall sconce: `wall-sconce` exists as a piece, but row 0 has no free square. The sconces are painted into the side walls instead, and their lights use the piece names `side-wall-west` and `side-wall-east`, which the game may not know.
8. Counter sign: a small blank plaque on the counter front.
9. Red post light: I added a faint flickering red light on each crossing-post lamp, which the brief didn't ask for.

Pieces (1 square = 37 px):

| Piece | Squares | Pixels | Notes |
|---|---|---|---|
| floor-a, floor-b, floor-edge, floor-edge-corner, floor-door | 1×1 | 37×37 | Flat. 1 px grout on all four sides, so turned tiles meet with no seams. The two door mats make one mat: (4,8) rot 0 and (5,8) rot 2 |
| wall, wall-pilaster | 1×1 | 37×130 | Wood cornice, cream plaster, red rail, panelled charcoal dado about a third of the height, wood skirting |
| wall-none, blank | 1×1 | empty | Corners and the solid side squares |
| arch, arch-east | 2×1 | 74×130 | Wood arch with a yellow keystone; 3 tracks meet at the middle |
| board | 4×1 | 148×130 | 3 rows of 7 flaps, 16×18 each. Pictures: train, clock (ticks, no numbers), nest, arrow (both ways), bird. No letters or numbers |
| seats | 3×1 | 111×46 | Seen from behind, cushions showing under the backs |
| counter | 3×1 | 111×34 | About 31 px tall, low enough for the stools to read |
| stool | 1×1 | 37×42 | |
| cafe-chair, cafe-chair-n | 1×1 | 37×42 | |
| match-table | 2×1 | 74×44 | |
| crossing-post | 1×1 | 37×84 | Arm raised straight up |
| shrub, shrub-b | 1×1 | 37×38 | |
| plant | 1×1 | 37×58 | |
| lamp | 1×1 | 37×76 | |
| wall-sconce | none | 15×13 | |
| hem | 1×1 | 37×24 | |
| entrance | 2×1 | 74×112 | exit: true |
| ring-crossing | 4×4 floor | 148×148 | Striped edge, an east–west road, a north–south track, a crossbuck in each corner |

Side walls: SHOP_BIRDIE_SIDE_WALL_GRID(west, run) gives run×37 by 130 px. It has a pilaster every 3 squares and a sconce between each pair. The west wall's left end is the front; the east wall is mirrored.

Exports:
- Layout and pieces: SHOP_BIRDIE_N = 10, SHOP_BIRDIE_LAYOUT, SHOP_BIRDIE_PIECES (each a Character with id shop-birdie-<name>), ShopPlace.
- Walls and board: SHOP_BIRDIE_SIDE_WALL_GRID, SHOP_BIRDIE_WALL_H = 130, SHOP_BIRDIE_BOARD_BOX = {x:12, y:20, w:124, h:60}.
- SHOP_BIRDIE_COUNTER_SIGN: the plaque's writing area, from signFace(42, 19, 27, 11).
- SHOP_BIRDIE_LIGHTS, each with its piece: the lamp shades, the sconces, the side-wall sconces, the bell and the urn (soft), the doorway's daylight, both arches' sky (soft), and the red post lights.
- SHOP_BIRDIE_POOLS: under the lamps, in front of the counter, and at the entrance.
- SHOP_BIRDIE_CAM.
- SHOP_BIRDIE_INTERIOR (id shop-birdie-interior, 370×484): the idle above, a review-<name> view for each piece (zoomed up to 4×) and review-floors.

In SHOP_BIRDIE_INTERIOR the side walls are folded flat beside the floor and the ground shadows are solid floor colours. Both are for viewing only.
