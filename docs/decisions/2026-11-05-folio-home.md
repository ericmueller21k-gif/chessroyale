# Folio's sanctuary in the game: the Folded House's inside, the paper turtle, its intro and the crumple (Nov 5, 2026)

Eric, Nov 5, on the room: "a peaceful sanctuary … some stained glass, some fountains, some bonsai plants … paper folding … something
kind of abstract … that makes it clear it's a different being than the rest." On the build: "crank through it." The crumple into the
match is his idea; no "meditate" anywhere (his). Folio is live, so its home goes to everyone, as Hollow's cave and intro did. The art:
`claude/boss-art` at e7e08bcf (`house-shop-folio` with its `paper-kit.ts`, `sidekick-folio-turtle`, `boss-folio`, `house-intro-folio`
with `crumple.ts`; notes `shop-folio-nov5.md`, `intro-folio-nov5.md`), copied in as Hollow's were (imports moved, the room still and
review strips left there). `characters/folio.ts` is unchanged.

## The director's calls (the art brief)

1. The room is a page still being written: written in the middle, ink sketch and ruled blank paper toward the edges, a margin line,
   lines writing themselves in, calm, never glitchy.
2. Stained glass of tissue in folded frames, its colored pools on the floor drifting as the "sun" moves; a ribbon fountain; folded
   bonsai, one with cranes; crane strings; pages drifting up; screens; a writing desk. No real place, temple, brand or script.
3. The battle spot is "the clean page", the marks on it, the boss west.
4. A low counter (at most about 32 px) with a blank plaque; the crate a masu box sealed with Folio's seal.
5. The shopkeeper a paper turtle, no name ("Shopkeeper"), not a town bot; the frog stays Folio's kid.
6. The intro: the walk-on and its entrance line; three flat sheets folding up, the stools then the table; a paper plane (not a crane)
   bringing the board, which unfolds like a map; a quiet line, one of five at random; the crumple into the match.
7. The code round (this brief): the crumple with the real screen, WebGL with a fade-through-black fallback, phone first; every beat a
   number in the feel; lazy-loaded art; the town's frame loop unchanged; full e2e lane.

## The art's calls (its notes; Eric may change any)

Room (`shop-folio-nov5.md`): (1) how the room fades, written in the middle, the back fading soonest, the edge uneven; (2) the margin
line on the west side; (3) the floor's folded squares, a quiet diamond lattice; (4) the windows on the side walls, so the back can
fade to blank; (5) one fountain; (6) the counter low (19 px), its plaque a tent card on its top; (7) the crate's seal across its seam;
(8) the marks, Folio's an ink brush ring round its seal, yours a gilt ring with a pawn; (9) the turtle's spectacles, its page stack,
sitting on its plastron, waving a front leg; (10) its extras (the moon window, the shelves of folded goods, the doorway's seal, the
lines writing on the back wall); (11) how strong the pools look is the game's to tune.
Intro (`intro-folio-nov5.md`): (1) you both step back a pace before the stools fold; (2) the sheets lie on the page from the start;
(3) the stools fold one after the other, then the table; (4) the table is Folio's own folded table and stays for the battle;
(5) the plane comes from the east and leaves to the north-west; (6) the board stays folded until the second fold; (7) the bow is
small; (8) the ball about 130 px across, turning a little while held, the picture swapped to the match while it's a ball; (9) the
mockup's quiet line, the code picks at random; (10) about 14.9 s in all. (The brief counts 15; the notes number 21, some the same
call seen from both sides. All are built as drawn.)

## The calls made here

- **The clean page is the battle circle.** Its 36 `page-<col>-<row>` tiles are floor (`isFloor` takes `page-`, never the drifting
  `pages`) and `marksOf` takes them as its circle; the drawn marks `SHOP_FOLIO_MARKS` are used.
- **The pools as color, drifting.** On the pale paper an added light barely shows (the art's note), so Folio's pools are laid over
  the floor by multiply (`RoomArt.poolBlend`), from a tint sprite fading to its own color see-through (a glow's black edge left gray
  rings). Their drift is a sine per pool on one clock (`driftAt`, `room.ts`), mirrored with a mirrored window. Every other shop's pools
  are unchanged.
- **The ceiling** is the mockup's pale folded paper (`roof: "paper"`). The turtle's sheet key is `folioturtle` (no hyphen).
- **The softer shadow, in this room only.** Folio is drawn here from its intro's own frames throughout (the glide walking on and
  stepping back, its idle, its bow), whose shadow is the art's warm see-through brown; the town figure's near-black shadow and the
  town's dark ground shadows aren't drawn under it here. Its battle and its town figure are unchanged.
- **The step back** is an eased slide (no hop): Folio to 2.3 squares from the table's middle (the art's, `BossIntro.clear`), you to
  the usual 2.2 (the art's 2.3; the shared rule kept). A unit test checks both clear of their stools.
- **The board.** The art's top views (the packet falling flat onto the table's top, lying, unfolding) are laid on the table's top;
  from the unfold's end the game's own board (`paintTable`, at its usual size as on every boss's table) comes in over the unfolded
  sheet in 0.25 s (`swapMs`): the game draws its boards tilted toward you and the art's sheet lies flat, so a cut showed a jump.
  The table's slab is its paper top, its squares the park table's ink, as the art's board.
- **The plane flies west as drawn** (its route runs east to west; the mockup draws it unmirrored).
- **No God King attack** in its intro: the crumple is its transition, as Hollow's dark is his.
- **Timing:** the art's timeline, its line 2.2 s: about 11.1 s from the marks to the crumple, 13.4 s to the match, about 15.5 s from
  just inside the door (the art's 14.9 s had a shorter walk-on). Every beat in `CHALLENGE_FEEL.folio`.
- **Sounds:** its own fold for every crease, its unfold for the board's two flaps, its rustle for the bow; new: `set` (a folded
  piece standing), `glide` (the plane), `land` (the packet), `ball` (the crumple) and `open`, under a move's loudness like its others.

## The crumple

- **The room's picture:** the room's canvas read at the moment of the crumple, and the page's DOM (the header, the chat) over it,
  drawn by the browser itself from a copy of the page in an SVG `foreignObject` with the page's own style rules (`snap.ts`). That copy
  is started as the quiet line goes (nothing changes on the page from then), 0.25 s ahead, so the crumple seldom waits on it (not
  measured on its own). If it fails or runs over 0.9 s, the canvas alone over the page's background (`data-dom="0"`).
- **The match's picture** is taken the same way once the battle shows under the cover, cross-faded in on the ball and opened. Flat,
  the creases' shade lingers over the live match (the cover multiplied over the page), so the handover has no jump.
- **The battle starts once it's a ball** (the cover reports "covered" after the 0.8 s crumple), so the crumple has the page's thread to
  itself; the room stops drawing under the cover. It holds as a ball as long as the match takes to load (as Hollow's dark holds
  black); once the match shows, its picture has 3 s (`maxHoldMs`), the open waits up to 0.7 s for the page to be idle.
- **Fallbacks, never stuck:** no WebGL, a shader or texture failing, the context lost, or the match's picture late: a fade through
  black (0.35 s each way). A last timer takes the cover away whatever happens.
- **The mesh** is the notes' 16 × 34 on a portrait screen (34 × 16 on a landscape one); each grid point's fixed parts (its place on the
  ball, its crease fields) are worked out once and blended per frame, with no allocation: the art's maths exactly (a unit test). No
  multisampling: in a software renderer it tripled the fill cost, and at 2 device pixels a CSS pixel its edges don't need it.

## Measured (headless Chromium, its WebGL in software (SwiftShader); this machine shared with other helpers, so numbers vary by run)

- **The crumple, phone (iPhone 13 emulation):** at full speed, 30 to 60 fps through the crumple, 30 to 60 held, 20 to 60 opening (the
  last three runs: 60/30/60, 30/30/60, 60/30/60). Its own work a frame: 0.2 to 0.6 ms. **At 4x CPU:** 15 to 20 fps crumpling, 7 to
  10 held (the battle loading under it), 9 to 15 opening; its own work 1.3 to 4 ms a frame. The rest is the software renderer and the
  battle starting; a phone's own GPU should draw a mesh this small at its refresh rate, but that's for Eric's real-phone check. (With multisampling it ran 12 fps at full speed; at 1 device
  pixel a CSS pixel 30.)
- **The shop, phone, walking 5 s, four runs in turn, medians:** Folio's 41.8 fps against Hollow's 42.6; at 4x CPU 13.2 against 12.8.
- The town's frame loop is unchanged (only the shop list and the card's Go in).
