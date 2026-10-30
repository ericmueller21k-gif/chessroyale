# The town on a computer: inside home's frame, the chat icon at the bar's left (Oct 29, 2026)

Lane: the director's (the town square). Area page: [town-square.md](../areas/town-square.md). Code: `town/TownPage.tsx`, `town/Town.tsx`,
`town/town.css`, `town/town-chat.css`, `components/FrontMenu.tsx`, `styles.css` (one selector), `App.tsx` (`goHome`). Tests:
`e2e/town-desktop.spec.ts`.

## Eric's words (Oct 29, with a screenshot of home on his computer)

> "All the white space around this is intentional. So on the left on the desktop is our menu stuff. On the right is the other stuff,
> like the global chat. I think this is the area I want the town to take up, the same container size that this large middle one
> takes up. Oh, and also on the town for desktop, it's actually too hard to see the settings and stuff for chat, or specifically where
> the chat is. So we actually, if we can, make it a special desktop thing where the chat icon, like the double green one that we have,
> that actually needs to sit on the left side of the top bar, because I think it's just too hard to see that that's where that is.
> Yeah, I just took another look at the desktop, and actually we can put the chat on the left. And then I think it'll be once we fit
> this town into the proper container size with our available space on the left and right, we may even be able to adjust it further."

Then, shown the stills, Eric picked **edge to edge**: the town fills the frame's whole center column.

## What it is

On a computer the town sits in the front door's frame: the side menu on the left, the live panel and the global chat on the right (all as on
home), and the town in the center column's box (`.fd-center`: home's middle box). Its bar ("Town square", back, the icons) is the box's top
line; the world fills the rest; the zoom pair, the focus button, the edge chips, the cards and the chat box are all inside the box. The chat
icon (the double green one) sits at the bar's left, right after the title; the gear stays alone at the right end. Phones and tablets are as
they were. No words on screen changed.

## The box (measured, headless Chromium, a mouse window; x, y, width, height)

| window | home's middle box (`.fd-center`) | the town's box |
|---|---|---|
| 1280 × 800 | 232, 0, 768, 800 | 232, 0, 768, 800 |
| 1440 × 900 | 232, 0, 888, 900 | 232, 0, 888, 900 |
| 1920 × 1080 | 376, 0, 1080, 1080 | 376, 0, 1080, 1080 |

At 1024 to 1279 px home stacks its cards and is taller than the window (512 × 871 at 1024 × 768, scrolling); the town keeps the center
column's left and width and the window's height (512 × 768), since it must never scroll. From 1280 px up the two boxes are identical (home's
card row shrinks to fit the window; measured at the three sizes above). (Other readings of "this large middle one" were the pawn card, 456 × 760 at
1440, and home's padded content block, 840 × 760; Eric chose the whole column from the stills.)

## The calls I made

- **What a computer is:** a window 1024 px wide or more **with a mouse** (`(min-width: 1024px) and (hover: hover) and (pointer: fine)`), the
  frame's own width and the same "with a mouse" test the desktop board uses (`board-size.css`). A tablet on its side (1024 × 768, touch) has
  the frame on home but its town stays as it was, since Eric said phones and tablets stay exactly as on main. A mouse window narrower than
  1024 px has no frame, so it keeps the whole screen and both icons at the right, like a phone.
- **The icon moves with the frame, not with the mouse.** One rule (`TownPage` tells the town it's `framed`; the CSS reads the class), so
  the icon is on the left exactly where the town has the frame.
- **Right after the title**, not at the far left before it: the back button keeps its place, "Town square" keeps its place, and the chat
  icon is the first thing after them, 12 px on (the bar's own gap). It never covers the title (tested). The gear alone at the right end.
  Least code: the tools' box becomes `display: contents`, the gear takes `margin-left: auto`.
- **Boss Arena is marked in the side menu** while you're in the town (the frame's new `page="town"`), as Play is on home, and the right
  column shows the global chat, as on home. `.fd-on-town` has home's 1080 px at most.
- **Every side-menu item leaves the town.** The menu's items (Play, Solo Boss Mode, Shop, Profile, Settings, the account button, a friend's
  invite) only closed front-door pages, so with the town in the frame they did nothing. `goHome` in `App.tsx` now closes the town too (Boss
  Arena opens it again). A friend's invite accepted from the town leaves it as well.
- **Known limit, left as it is (the director's call):** resizing a mouse window across 1024 px adds or takes away the frame, which starts the
  town again at its start square. Nothing else does.
- **Nothing jumps while it loads:** until the town's chunk arrives the center holds the page's plain placeholder, which is as high as the
  window, so the menu, the center and the right column keep one box each from the first frame (tested).
- **The chat box** is where it was, 8 px in from the world's top left, in every chat mode; the typing and tag guards are untouched.

## Frame rate (eric.md's method)

Headless Chromium, a phone 390 × 844 (pixel ratio 3) and a computer 1440 × 900, the default view, 5 s walking (a tap ahead every 1.25 s),
frames counted in the page, 4 s warm-up, main and this branch built and served side by side, runs taken in turn, medians of 8 runs per
build each pass, two passes (the second in the opposite order); main twice in each pass as the noise control. Under the shared lock,
the machine otherwise quiet.

| medians (8 runs a build) | phone fps | computer fps |
|---|---|---|
| pass 1, main | 50.6 (19.3 ms a frame) | 41.5 (24.2 ms) |
| pass 1, this branch | 49.4 (19.8 ms) | 52.3 (18.3 ms) |
| pass 2 (opposite order), main | 49.5 (19.9 ms) | 39.7 (25.3 ms) |
| pass 2, this branch | 50.8 (19.3 ms) | 54.1 (17.4 ms) |

**No slower.** The phone is level (−1.2 and +1.3 fps in the two passes, while two runs of the same build differed by up to 3.2): its
code path is the same, nothing is wrapped and nothing is added to it. The computer is faster (about +11 to +14 fps), because its canvas is
888 px wide instead of 1440: fewer pixels to fill, the same squares drawn. Nothing was added to the town's frame loop; the frame is plain DOM
round it (its panels poll now and then, never per frame).

## Checks changed (old → new)

- `e2e/town.spec.ts`, "the town square at /town: the world is drawn and fills its box…": the world's width **as wide as the screen** (`cv.width`
  within 1 px of the viewport's) → on the computer (desktop project) **as wide as the front door's center column** (`.fd-center`), on the
  phone project the screen's, as before. Not an eric.md guard.
- `e2e/town-chat.spec.ts`, "the edge chips keep off the chat box…": the chip that gave way "took its old place back" was measured against the chip's place **when the box
  was put over it** → against its place **before any box was put over it** (`quiet`). In the computer's narrower box an earlier try (a chip by the buttons, where the box can't
  go) had already nudged that chip 54 px, so the old baseline was a nudged place, not its own. Same check, on the same chip, on a phone and a computer; the chips' behavior is
  unchanged. Not an eric.md guard (the chat guards there are "typing works wherever the box shows…" and the name tags', untouched).
- `e2e/areas.json`: the town's area runs `e2e/town-desktop.spec.ts` too.
- New: `e2e/town-desktop.spec.ts` (the box, the frame's parts, the icons, nothing poking out, the menu, loading, a narrow mouse window, and
  phones and tablets against main's boxes).
- No guard test was edited: `e2e/town-chat.spec.ts`'s "typing works wherever the box shows…" and `e2e/town-tags.spec.ts` are untouched.

## Oct 30: the world fills the whole space between the menu and the right column

Eric (Oct 30, his sketch): the town runs out to the side-menu and right-column lines, top to bottom; its bar moves to the right column's top row. On a computer
the world is now the whole space between the menu and the right column (no 1080 px limit, no bar of its own), and the bar (back, "Town square", chat icon, gear) sits where
the profile button is on other pages (not shown on the town page; its row keeps its height). Back, chat and gear are 44 px, the profile button's size. The title is 15 px
below 1440 px so the four fit the 280 px column. Frame rate (headless, 4 runs in turn, medians): 1440 × 900 main 58.6, here 59.0; 1920 × 1080 main 58.2, here 48.6 (the canvas is 1.6x the pixels): slower, left for Eric. Checks changed: town-desktop.spec.ts box checks (home's middle box, bar 52 px at the box top, gear 14 px from the right → the space between menu and right column full height; bar in the right column, 44 px buttons in order); town.spec.ts "world starts under the bar" → computer: at the window's top; town-chat.spec.ts "under the bar" → computer: on the map. No guard test edited.
