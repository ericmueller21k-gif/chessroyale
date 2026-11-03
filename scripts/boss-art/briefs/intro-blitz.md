# Blitz's battle intro: three dashes, a shoe-box table, and a clock-and-numbers screen cover

**Drawn by hand in this session on the weekly plan usage, not the API runner** (Eric, Nov 3). Make the same files and
format the runner makes.

## Eric's design (Nov 3, his words)
"Since he's a cheetah make the animation like u both walk up to the spots, then he suddenly bolts away leaving a train of
dust and then comes back very fast drops the board, then again runs off, comes back and suddenly the pieces are there,
then again flies across and drops off both chairs, then it starts." The table: "a stack of shoeboxes is perfect." The
screen cover: "his screen cover should be numbers, clock/time themed."

- **Sides:** the boss is on the **left**, you on the **right**, with the table between you.
- **Length:** about 12 s at most; snappier is better for a speedster.
- **Sounds:** his sounds, if he has a set: check `packages/app/src/characters/` for a blitz or cheetah sounds file. If
  there's none, name generic cues (`whoosh`, `skid`, `thud`, `pop`, `tick`, `ding`) and say so.

## Read first
- Blitz: `scripts/boss-art/out/boss-blitz/boss-blitz.ts`, his rig, palette and animations. His `entrance` zips in with
  speed lines and skids to a stop, which is the closest model. He's drawn facing our left.
- The other intros, for structure and how code plays them:
  - Timber's, the newest: `scripts/boss-art/out/house-intro-timber/house-intro-timber.ts`, his moves `BOSS_BEAVER_INTRO`
    in `scripts/boss-art/out/boss-beaver/boss-beaver.ts`, the notes `scripts/boss-art/out/intro-timber-nov3.md`, and the
    mockup script `scripts/boss-art/intro-timber-view.ts`;
  - Big Boy's: `scripts/boss-art/out/house-intro-bigboy/house-intro-bigboy.ts` and `scripts/boss-art/out/intro-bigboy-nov2.md`.
- His shop: `scripts/boss-art/out/house-shop-blitz/house-shop-blitz.ts`. Its shoe boxes (orange with a white stripe and
  a teal lid) are what the table and stools are made of.
- `packages/app/src/town/houses/park.ts` (`PARK_TABLE`, `TABLE_BOARD`, the palette keys `"1"`-`"5"`, `L`, `D`) and the
  renderer's `paintBoard` in `packages/app/src/town/render.ts`. The renderer draws the slab and board: `"4"` the front,
  `"2"` the top, `"1"` the top edge, `L`/`D` the squares.

## What to draw
### 1. Blitz's moves: `BOSS_BLITZ_INTRO` in `boss-blitz.ts`
Add to the file; don't change any existing animation or part.
- **The character:** id `blitz-intro`, spreading `BOSS_BLITZ`, in a frame big enough for the motion, with the foot at
  his feet.
- **Facing:** he stands on the left, so he faces **our right** (mirror him, as Timber's intro did); say so.
- **Animations:**
  - `bolt`: about 4 to 5 frames. He crouches, then launches off to our **left**, out of frame, in a burst of dust. The
    last frame is empty but for a dust cloud and speed lines.
  - `arrive`: about 6 frames. He zips back in from our left in a blur, skids to a stop at his spot with dust spraying,
    and drops what he carried with a flourish (a slam-down or a toss). Code shows the dropped thing from the cue frame on.
    The cue `drop` marks it.
  - `dashBy`: about 4 frames, looping. A full-speed blur of him running, for code to slide across if it wants.
  - `idle`: one still.
  - Optionally `brag`: about 6 frames, for the end: dusts off his jacket, a finger gun at you, a grin.
- **Export `BLITZ_INTRO_DROP_AT`:** where the dropped thing lands relative to his foot, in `arrive`'s drop frame.

### 2. The props: `house-intro-blitz`
File: `scripts/boss-art/out/house-intro-blitz/house-intro-blitz.ts`.
- **`INTRO_BLITZ_TABLE`: the shoe-box stack table.** It has `PARK_TABLE`'s width, foot and slab height (the top of the
  stack at the renderer's slab height, `TABLE_BOARD.top` over the foot, about 26 px), so the board lands right.
  - **The stack:** shoe boxes from his shop, stacked a little crooked, three or four high, the top box flat for the board.
  - **No stools:** the stools are separate pieces.
  - **Animations:**
    - `land`: about 5 frames. The stack drops into place with a thump, a squash and a puff. Code shows it when he
      `arrive`s with it, so it lands as he skids in.
    - `idle`.
- **`INTRO_BLITZ_TABLE_PALETTE`:**
  - `"1"`-`"5"`: the slab, a shoe-box lid in teal or orange;
  - `L`/`D`: the board's squares in his colors, **easy to read**, with cream and charcoal pieces showing clearly on both.
    Show this in the review sheet on a small 8 x 8 board with a few of `TABLE_PIECES`' shapes.
- **`INTRO_BLITZ_STOOL`:** a single shoe box standing as a seat, its top at the park stools' seat height (about 10 px).
  - **Placement:** one goes on each side of the table, at the table's foot x ± 37.
  - **Animations:** `land` (about 5 frames: it drops in with a bounce and a puff) and `idle`.
  - **Export `INTRO_BLITZ_STOOL_SEAT_H`.**
- **`INTRO_BLITZ_DUST`:** his dust trail, a streak of dust and speed lines left where he bolts. About 6 frames as it
  billows and fades. It's wide, so code can stretch or repeat it along his path; say how.
- **`INTRO_BLITZ_POP`:** about 5 frames. The "suddenly the pieces are there" moment: a quick burst of sparkles and speed
  lines over the board as the pieces appear, about the board's size. Code shows the pieces from its cue frame.
- **The screen cover: `INTRO_BLITZ_STORM` and `INTRO_BLITZ_FRONT`,** played exactly like Alfil's sandstorm, so the same
  code runs it.
  - `INTRO_BLITZ_STORM`: 128 x 128, **tiles seamlessly both ways**, 6 frames at 70 ms, looping with no jump. A rushing
    field of **numbers and time**: digital clock digits (00:59, 12:00, 0:03 and so on), stopwatch faces with hands
    sweeping, ticking second marks and speed lines. All of it races right, in his teal, orange and white on a dark
    ground, fully opaque.
  - `INTRO_BLITZ_FRONT`: 48 x 128, **tiles top to bottom**, 6 frames. The leading edge: its left side matches the storm,
    its right side is ragged, with digits and clock faces flying ahead.
- **`HOUSE_INTRO_BLITZ`:** a review sheet (id `house-intro-blitz`). Its `idle` shows the pieces side by side, with one
  extra animation per piece animation, plus a 3 x 2 tiling of the storm with its front on the right to check the seams.

## The timeline (code plays it; about 10 to 12 s)
| Time (s) | What happens |
|---|---|
| 0 | You both walk to your spots (the shared intro); he says a line. |
| 1.5 | `bolt` off to the left; the dust trail. |
| 2.3 | `arrive` with the shoe-box table: it `land`s on his `drop`. |
| 3.5 | `bolt` again; the dust. |
| 4.3 | `arrive` with the board: code drops the board onto the table on `drop`. |
| 5.5 | `bolt`; the dust. |
| 6.3 | `arrive`; `INTRO_BLITZ_POP` over the board, and the pieces are there. |
| 7.5 | `bolt`; the dust. |
| 8.3 | `arrive`; both stools `land`, one each side. |
| 9.3 | `brag` (or idle). |
| 10.0 | The screen cover sweeps across, and the game starts. |

Eric's words have the board come on the first dash. With the table now made of boxes, the first dash brings the table
and the second the board; the pieces and chairs follow. If the timing feels better with the table and board together on
the first dash, do that and say so.

## How to check and deliver
- Render with small tsx scripts (`renderFrame` and `png`/`blank`/`blit` from `scripts/boss-art/render.ts`) and Read the
  PNGs. Typecheck with `npx tsc -p scripts/boss-art --noEmit`.
- Make a **whole-intro mockup GIF** side-on, like `scripts/boss-art/intro-timber-view.ts`: copy it to
  `scripts/boss-art/intro-blitz-view.ts`. Use a stand-in board on the table, the board's squares and a few piece blobs
  after the pop, and dust drawn where he bolts. Save it as `house-intro-blitz/view-intro-sequence.gif`, with key frames
  in `view-intro-keyframes.png`.
- Make the screen-cover GIF with
  `python3 -I scripts/boss-art/storm-view.py <dir with storm/s*.png and f*.png> scripts/boss-art/out/house-shop-blitz/view-close-in-circle.png house-intro-blitz/view-clock-phone.gif`.
- Write `scripts/boss-art/out/intro-blitz-nov3.md` in the style of `intro-timber-nov3.md`. Include:
  - the exports, feet, frames and cues;
  - the timeline;
  - "For the code helper" and "Calls Eric may want to change";
  - "Drawn by hand on the weekly plan usage" where the cost would be.
