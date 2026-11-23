# Name tags: only near you by default, blue for the boss sidekicks (Oct 28, 2026)

Phone and computer. Eric tried 50 bots in the town and the names ran together. Keeps the frame-rate rule (`docs/rules/eric.md`, "The town square") and
the #399 tag cache (each tag drawn once and stamped). How it works now: [`docs/areas/town-square.md`](../areas/town-square.md), "Name tags". Same PR as
the chat's v4 ([2026-10-28-town-chat-v2.md](2026-10-28-town-chat-v2.md), "v4"), its own commits.

## Eric's words (Oct 28, after trying 50 bots)

"the little boss helpers have special blue names, could we also try another toggle in settings. The current way become the visible names switch, the
default will be only people in the radius around you have names shown and as you walk they fade in and out, the people are always visible but the name
tags no … I'd say the radius should be about ironically enough an 8x8 area of squares maybe 10x10". He approved the director's proposal below.

## What it is

- **Names near you (the new default).** A figure's tag shows only while it is within **5 squares of you in both directions** (|dc| ≤ 5 and |dr| ≤ 5, from fractional
  positions: about a 10 × 10 area round you). It **fades, it doesn't pop**: over the last square at the edge (alpha 1 at 4.5 squares, 0 at 5.5, in a straight line),
  from positions each frame, so tags fade in and out as you or they walk. Nothing is stored or allocated per frame. It combines with today's far-distance fade
  (toward the rim) by taking the smaller alpha. **Always shown, whatever the distance:** your own tag (gold); anyone whose card is open; anyone seated at a table
  with you, or walking to or from a game with you. The figures themselves are always drawn as now; only the tags go. The numbers are in `feel.ts` (`nameRadius: 5`,
  `nameFadeSquares: 1`), never in the drawing code.
- **The setting:** in Town settings a new section **"Names"** under Chat, two choices like the chat's: **"Near you"** (the default) and **"Everyone"** (exactly today's behavior),
  with the line "Near you: names show within 5 squares of you." Remembered on this device (`brc.townNames`).
- **Sidekicks' tags are blue:** a blue pill with white text in place of the white pill with dark text, for the 14 boss sidekicks only (a bot whose look is a sprite); pawns stay
  white, you stay gold. The tag cache keys on the tag's kind (`you` / `bot` / `sidekick`), not on a gold-or-not flag.
- **`eric.md`:** one bullet in the town square's named exceptions to "nothing hidden": "Name tags show only near you by default (Eric, Oct 28); 'Everyone' in Town settings shows them all."

## The blue

The sidekicks' blue is **`#1d4ed8`** (Tailwind's blue-700) at the pill's usual alpha, .96, with **white text**. White on it is **6.2:1** in the worst case (the translucent pill over a white
backdrop; 7.1:1 over black), where WCAG AA asks for 4.5:1: it reads at the smallest tag size on any of the town's backdrops. Against the backdrops themselves (the pill's blend over each, WCAG's ratio, the colors the
renderer uses: the day and night sky's stops, the checkered sand, the paving, the grass, and the night's tint over the ground):

| backdrop | by day | by night |
|---|---|---|
| sky, top / middle / horizon | 2.8 / 3.8 / 4.9 | 2.8 / 2.3 / 1.6 |
| sand, light / dark squares | 4.0 / 1.9 | 2.0 / 1.1 |
| paving, light / dark | 4.4 / 3.6 | 2.2 / 1.9 |
| grass, light / dark | 2.8 / 2.4 | 1.5 / 1.3 |

By day it is no weaker than the white pawns' pills (1.2 to 3.2 over the same things); by night over the dark-tinted ground its separation is lower than a white or gold pill's (those are 2.8 to 16) because a pill that
white text reads on has to be dark: a lighter blue fails the text (`#2563eb` is 4.8:1, `#2f6bf0` 4.4:1) and a darker one disappears into the night sky (`#1e40af`, 7.9:1 for the text, 1.2:1 against the night sky's
horizon). So it is the middle one, and the only saturated color on a desaturated ground, with the tag's usual soft shadow; the stills in the hand-off show it by night and by day. If Eric finds it weak at night, the
lighter `#2563eb` (text still over 4.5:1) is one line in `TAG_STYLE`.

## My calls

1. **The distance is the larger of the two directions** (`max(|dc|, |dr|)`), so "within 5 squares in both directions" is a square 10 across with you in the middle, as Eric's "8x8, maybe 10x10". It is measured between **you** (the same pose that draws your pawn) and the
   figure, round the world's wrap, never from the camera (the camera may look elsewhere).
2. **Always shown means the near rule is skipped, not the far one.** A tag past two thirds of the way to the rim is hidden today (the horizon's end); it still is, for an open card's figure too, since there is no room to draw it there.
3. **"Whose card is open"** is the figure the open card holds still (`town.hold`: a person's own card, a real player's too since #404, or the card of the table where a bot waits); **"at a table with you"** is a figure seated at the table you sit at (`seated`); **"walking to or from a game with you"** is `town.meet` (from Play, through the walk and the stools) and `town.leave` (the bot walking off after the game). Bosses have no tags (their names float over their homes, as before): the setting is about the people's.
4. **`TagCache`** (in `tags.ts`) is the #399 cache's keyed lookup and its least-lately-used eviction, moved out of the renderer so they can be tested without a canvas (the renderer keeps the canvases): the kind is part of the key, so a sidekick's blue tag and a pawn's white one of the same name and size are two drawings. The behavior is the same, with one repair: after an eviction the cache re-reads the name's list, where the old code could have pushed the new drawing onto a list that had just been dropped.
5. **The test hook** `__townTags()` (test switches on) lists the tags drawn in the last frame (name, kind, alpha, pill, ink, box on the screen): the tests read what is drawn, not the world's numbers.
6. **`town.spec.ts`'s tap-through helper** is the chat box's (the v4 box takes every touch while it shows); no tag check there changed: `town.spec.ts` reads no tags.
7. **The card's ring is a different blue, on purpose.** #404 (the town's dark cards, merged first) gave a sidekick's picture on the person card a ring of `#4575fa` (the mockup's), and
   left it open whether the tags' blue is the same. It isn't: a ring needs 3:1 against the dark card (`#4575fa` has 3.95:1; `#1d4ed8` would have 2.4:1), a tag needs white text on it at
   4.5:1 (`#1d4ed8` has 6.7:1, over 6 on the lightest backdrop; `#4575fa` has 4.06:1 with white, too close to the line once the pill is translucent). Two jobs, two blues of one family;
   the comments in `town.css` and the card's decision file say so.

## Frame rates (eric.md's method)

Same method, in the same rounds as the chat's (eight runs in turn, `main` d37afef9 as the control, `?crowd=50`: fifty testers' bots in the square, which is Eric's case), medians with the paired difference to `main`:

| `?crowd=50` | phone median | paired to main (median / mean) | computer median | paired to main (median / mean) |
|---|---|---|---|---|
| `main` | 54.0 fps (18.2 ms a frame) | | 45.7 fps (22.0 ms) | |
| **Near you** (the default) | 53.2 fps (18.5 ms) | −0.3 / +0.2 fps, +0.1 ms | 44.8 fps (22.3 ms) | −1.3 / −0.5 fps, +0.6 ms |
| **Everyone** (today's behavior) | 53.7 fps (18.4 ms) | +0.5 / 0.0 fps, −0.1 ms | 46.0 fps (21.8 ms) | +0.5 / +0.2 fps, −0.3 ms |

Both are level with `main` within the run-to-run spread (`main`'s own eight runs on the computer span 43.8 to 47.3 fps, on the phone 48.9 to 57.4). Near you's computer median is a little under `main`'s; its main-thread time
(+0.3 to +0.6 ms a frame) and its mean (−0.5 fps) are inside that spread too, and nothing in the rule can cost it: a distance and a smaller alpha for each figure drawn (a few dozen of them), with no allocation, and fewer tags
stamped than before. I read it as noise; the numbers are here for him to judge, and `?crowd=50` is the switch to look for himself. The tag cache is unchanged in cost (a lookup by name, size and kind).

## Test checks changed (old → new)

None of the existing checks reads or counts tags (`town.spec.ts` and the hooks read none; the lamp hooks' "no name tag over the glass" check only gets easier with fewer tags). New: `packages/app/test/town-tags.test.ts` (the alpha at 4, 4.5, 5, 5.5 and 6 squares, your tag, an open card's figure and a table partner always shown, the far fade's smaller alpha, "Everyone", the setting remembered, the kinds' colors and the blue's contrast, the cache keyed by kind and its eviction)
and `e2e/town-tags.spec.ts` (phone and computer: a far figure has no tag in Near you and has one in Everyone, a near one has one, yours always, a sidekick's is blue with white text, on screen too; the sheet's "Names"; the setting survives a reload; a tag fades as you walk away and an open card keeps it).
