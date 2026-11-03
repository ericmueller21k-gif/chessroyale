# Brief: Hollow's cave (art): the inside of Hollow Peak, and his dog, the shopkeeper

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art` (shared with other art sessions: `git pull --no-rebase origin
claude/boss-art` before each push; never force-push). Opus high. **Drawn by hand on the weekly plan usage (Eric, Nov 3), not the
API runner.** Make the same files and format the runner makes. Art only: no app code (the code round wires it after).
Include notes/briefs/rules-common.md.

## Who Hollow is (keep it subtle: players work it out themselves)
Hollow (`scripts/boss-art/out/boss-hollow*`, his town home `packages/app/src/town/houses/hollow.ts`, "Hollow Peak") is not evil:
a lonely, lost soul living up in a cave above the town, who once loved the winter holidays and secretly still loves the lights.
The cave is full of nods to a famous holiday story about a grumpy hermit on a mountain, a sled, a pile of presents and his dog
with antlers tied on. **Never** that story's names, its town's name, quoted lines, or traced art; nothing from its films. Nods,
not copies: "obvious once you get it" (Eric).

## 1. The room: a cave, not a box (`house-shop-hollow`)
File `scripts/boss-art/out/house-shop-hollow/house-shop-hollow.ts`. Follow Dash's and Timber's shops for the exports and
structure (`house-shop-blitz/house-shop-blitz.ts`, `briefs/blitz-house-and-shop.md` §2, `out/shop-blitz-nov3.md`): pieces as
`Character`s in `SHOP_HOLLOW_PIECES`, `SHOP_HOLLOW_LAYOUT`, the room still `HOUSE_SHOP_HOLLOW`, `SHOP_HOLLOW_COUNTER_SIGN`,
`SHOP_HOLLOW_CRATE_AT`, `SHOP_HOLLOW_MARKS`, `SHOP_HOLLOW_LIGHTS`, `SHOP_HOLLOW_POOLS`. 37 px squares, flat floor tiles.
- **Shape (new):** on the 20 x 20 grid, but the walkable floor is a **cave**: you come in at the mouth (front, row 19), it runs
  long and narrow (about 6-8 squares wide), and **curves round at the back** to where the counter sits, out of sight from the
  door. Export the floor as `SHOP_HOLLOW_FLOOR`: 20 strings of 20 chars, `.` floor, `#` rock. Keep it simple to walk: no
  1-square pinches, at least 2 wide everywhere, the battle spot fully on floor.
- **Walls:** rock pieces to stand along the floor's edge (straight runs, outer and inner corners, a few variants), upright like the
  other shops' walls, dark stone with frost; and stalactites/icicles from the ceiling band. Say in the notes which piece goes on
  which edge so the code round can place them from the mask.
- **Light:** dark, but you must see well: warm pools from **lanterns hanging from the ceiling**, lit and flickering, swaying a
  little (idle frames), and a **string of old, mismatched holiday bulbs** pinned along the rock (a few burnt out; his favourite
  thing). Lights and pools in `SHOP_HOLLOW_LIGHTS`/`_POOLS`.
- **Props (Eric's, then the director's):**
  - a big wooden **sled** leaning on the wall, an overstuffed sack on it;
  - his **"tree"**: a tall pile of presents, ornaments and trinkets stacked into a tree shape, a star on top (the showpiece,
    about 2 x 2 or 3 x 2, upright);
  - the hanging lanterns and the bulb string;
  - a worn **armchair by a small fire pit**, one stocking hung on a rock;
  - a **peephole or old telescope** in a crack, pointed down at the town's lights;
  - a pile of things he "borrowed" from the other homes (a balloon, a plank, a toy: small, generic);
  - an **advent calendar** with every little door pried open;
  - snow drifted in at the mouth.
- **Battle spot:** a **frozen pond**, a little cracked, its edge frosted; the two start marks on the ice (boss west, you east, on
  one line, as the other shops'), `SHOP_HOLLOW_MARKS`.
- **Counter:** at the far end round the curve: a rough plank-and-rock counter, at most about 32 px tall so the dog shows; a blank
  plaque (`SHOP_HOLLOW_COUNTER_SIGN`). **Hollow's Boss Crate** on it: a battered present box tied with dark ribbon, faint light
  leaking from its seams (idle: a glint/flicker).

## 2. The shopkeeper: his dog (`sidekick-hollow-dog`)
File `scripts/boss-art/out/sidekick-hollow-dog/sidekick-hollow-dog.ts`, made like the other sidekicks
(`out/sidekick-blitz/sidekick-blitz.ts`): a `Character` with **idle, walk, sit, wave**. A dark, shaggy, droopy-eyed loyal mutt,
**antlers tied onto his head** with string, maybe a too-big knitted scarf. Dark palette (charcoal, slate) with warm eyes so he
reads in the dark. About the size of the other kids. (Glim, Hollow's kid, `out/sidekick-hollow/hollow.ts`, stays as he is and
keeps walking the town; the dog keeps the shop.)

## Not in this round
His custom challenge intro (the lanterns going out, the bulbs lighting the board): later.

## Deliver
Notes `scripts/boss-art/out/shop-hollow-nov3.md` like `shop-blitz-nov3.md` (the piece table, the floor mask, the wall-piece
placement, every call Eric may want to change). Review stills: the room still (`room.png`), close views at the mouth, on the
pond, at the counter with the dog, and the tree; the dog's four animations as GIFs (3x). Push. Reply with the head sha, the
still paths, and the calls for Eric.
