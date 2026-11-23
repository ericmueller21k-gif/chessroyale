# Home, said once: no ⓘ, no sub-labels, the line above PLAY, pictures beside the words, a bigger PLAY; a test rank and level for admins (Oct 28, 2026)

Eric, Oct 28, with a screenshot of his phone's home (a 430 px phone, the options open, the ⓘ's pop-up over the pawn):

> 3 times in this screen it says the same thing. Delete the i icon completely, then let the 3 containers fit the empty space
> left behind from it, delete the text under each buttons title, swap the line of text below Play and put it above play. The
> icons in boss solo and autochess are above the text … there's plenty of space for them to sit to the left of the text in
> those containers, then shrink those down vertically and make the play button bigger with the space we gain. Delete
> 'weighty' and replace with Opal III for me as a random test rank … the progression line should be a green border around the
> custom ICON, a little 38 above it, centered, to denote the level 'lvl - 38' very tiny same length as the icon … show it at
> 3/4 like I'm 3/4 to level 39.

A phone and a computer alike (no platform named means both, `docs/rules/eric.md`). Lane: `hub`. Area page:
[hub.md](../areas/hub.md). Standing rule kept: [2026-10-25-home-panel-back.md](2026-10-25-home-panel-back.md) ("nothing
hidden, nothing shifts"), with [2026-10-18-phone-home-fits.md](2026-10-18-phone-home-fits.md) (a phone's home fits).

## What was said three times

"Starts within 60 s; bots fill any empty seats" under PLAY, "Default adds bots after 60 s to keep the wait short" in the ⓘ's
pop-up, and "bots at 60 s" under Default. Bots off and Solo the same ("people only", "you + bots", the line under PLAY and
the pop-up).

## What changed

- **The ⓘ and its pop-up are gone.** The three options (Default, Bots off, Solo) fill the row, the same 5 px frame and 6 px
  gaps as before: the group is as wide as the RANKED row above it.
- **The options are titles only**, 44 px buttons (48 px before), so the panel is 54 px tall (58 px). Squads' two choices share
  the panel and keep their words (see the calls below).
- **The line that says what the pick does moved from under PLAY to just above it** (the same words). It is one box with one
  place and one height for every pick: two lines' room on a phone (a paused line or a sign-in line may wrap), one line on a
  computer, its text bottom-aligned so a one-line text sits on PLAY, and empty with no mode picked, as before.
- **The Other modes cards have their picture to the left of the words**, and are shorter:

  | | phone before | phone now | computer before | computer now |
  | --- | --- | --- | --- | --- |
  | Boss Arena | 84 px, picture 64 px | 64 px, picture 48 px | 64 px | 64 px (already so) |
  | Solo Boss Mode, Auto chess | 84 px, picture above | 56 px, picture 32 px beside | 64 px | 56 px |

  The picture is 28 px on a phone under 360 px wide, with 11 px words, so "Solo Boss Mode" stays on one line in a 137 px card.
  The half cards lost their ›: at 390 px the name needs 103 px and the picture, gap and padding leave 103 px with no room for it
  (Boss Arena keeps its ›).
- **PLAY takes the room that gave back**, and nothing else moves. Measured against main at every size the fit test uses
  (360×640, 375×667, 390×664, 390×844, 430×932) and at 320×640, 1024×768, 1280×680, 1280×800 and 1440×900: the pawn's card, the
  page's height (scroll), the last card's foot and the live window's board are the same to the pixel; only PLAY is taller.

  | | before | now | where the room came from |
  | --- | --- | --- | --- |
  | PLAY, phone | 64 px, label 30 px | **97 px**, label 44 px | options 4 + Boss Arena 20 + pair 28 − 15 (kept under the last card) − 4 (the label's) |
  | PLAY, computer 1024 px and up | 64 px, label 36 px | **76 px**, label 40 px | options 4 + the pair 8 |
  | PLAY, computer under 760 px tall | 48 px, label 28 px | **60 px**, label 32 px | the same 12 |

- **An admin's test rank and level** (only where `testSwitchesAllowed()` is true: an admin, or a server with `TEST_SWITCHES`
  on; players see home as before): the rank line reads **"Opal III · 1580"** (the rank's name replaced, the rating real), your
  icon has a thin green ring filled to 3/4 clockwise from the top over a faint track, and a tiny **"LVL 38"** in the rating's
  gray sits over it, as wide as the icon. All of it is placeholder until the real ranks and levels exist, in one place:
  `TEST_RANK` and `TEST_LEVEL` in `components/FrontDoor.tsx`.

## The ranking sentence ("Your ranking changes only in a match with at least 30 real players (15 in a raid). Solo games never change it.")

The FAQ's "Your rating" said the rule only as a share ("at least 30% of its seats are real players; solo games and practice mode
never count"), never as those counts, so **I added the sentence in the pop-up's words** to the end of that entry
(`faq/content.ts`; the 30 and 15 come from the settings, as the pop-up's did).

## Player-visible text (old → new)

- Options: "Default / bots at 60 s", "Bots off / people only", "Solo / you + bots" → "Default", "Bots off", "Solo" (a screen
  reader's names too: "Default bots at 60 s" → "Default").
- The ⓘ button ("About matchmaking") and its pop-up (four sentences) → gone; the last is in the FAQ, "Your rating". The other
  three said what the line above PLAY says.
- The line (e.g. "Starts within 60 s; bots fill any empty seats") → the same words, above PLAY.
- Solo Boss Mode and Auto chess cards: the › in their corner → gone.
- Admin only: "Weighty · 1580" → "Opal III · 1580"; new: "LVL 38" and the ring.

## Calls I made

- **Squads' two choices ("Solo queue / you join a squad", "Party / with up to 3 friends") keep their words.** Eric named the three
  matchmaking options in his screenshot; the Party words are the only place home says "up to 3 friends", and the line above PLAY
  doesn't. They fit the 44 px buttons. A one-line change if he wants them title-only too.
- **Boss Arena's card on a computer stays 64 px** (its picture already beside the words, as Eric wants the phone's); the pair
  goes 64 → 56 px. On a phone all three got shorter.
- **No ›, and a smaller picture at 320 px, on the half cards**, so each name stays whole on one line at every phone width from 320 px.
- **PLAY is 97 px, not 112 px, on a phone.** All the room could have gone to PLAY (116 px), but the last card's foot would then
  sit 15 px lower than it has (the room the old one-line hint left under it), against "nothing below moves down"; and the
  "Other modes" label keeps its 14 px under what's above it (PLAY now, the line before), as approved. The 15 + 4 px are
  one CSS line each if Eric would rather have a bigger PLAY.
- **The line's box is two lines tall on a phone always** (17 px more than a one-line box): a paused line ("Solo and Boss alone are
  resting for a bit. Back soon.") and the sign-in lines wrap at 320–390 px, and a box that grew would move PLAY. This is the Oct 18
  rule (two lines' room on a phone), kept; the one-line trick (`fd-hint-line`) that gave the room back under the cards is gone.
- **The ring and "LVL 38" take no room** (drawn outside the icon's box, absolute), so the tag, the card and the page are the same
  for an admin and a player, and nothing moves when the account (and its admin flag) loads. The label sits at the top of the
  pawn's card on a phone, where the card's padding leaves it room (it touches the card's top edge at 390 × 844: Eric's phone
  will say if it wants the pawn a few pixels smaller).
- **The cards' words never wrap, and the "Other modes" label has its own line height** (`white-space: nowrap` on the cards' name and
  line, `line-height: 12px` on the label). Found by running the guard 16 times at once (4 workers): about one run in five failed
  at 1280 × 800, PLAY and the line above it 3.9 px lower than a moment before. A layout-shift recorder showed why: while Archivo
  (the page's text font) was still loading, "Solo Boss Mode" wrapped to two lines in the fallback font in a 155 px half card, so
  the pair was 59 px tall instead of 56 px, and the label 13 px instead of 12 px; when the font arrived the cards shrank and
  everything above them in the bottom-anchored column moved down. The old cards (84 or 64 px minimum) had room for the extra
  line, so it could not show; the new, shorter ones do not. Now no card or label's height depends on the font (checked with
  Archivo blocked: the card stays 56 px, the label 12 px), and the guard passed 16 of 16 at 4 workers (main's own guard: 16 of 16;
  this change before the fix: 2 of 12, 4 of 16, 3 of 16 and 3 of 16 runs failed).
- **`scripts/frames-matchmaking.mjs`** (the by-hand frame check of matchmaking) no longer taps the ⓘ.
- **"LVL 38"**, not "lvl - 38": it matches the boss banner's "LVL 53".
- **Admin with no rating yet** still reads "No rating yet" (there is no rating to put after "Opal III").
- **Every e2e account is an "admin" by the switches** (the test server has `TEST_SWITCHES` on), so they all show the placeholders;
  `profile.spec.ts` tells its page it's a player (`switchesOff`) to keep checking the rank line a player sees.

## Tests: every changed check (old → new, and why)

The one test that guards a rule in `eric.md` is `home-ranked.spec.ts`, "Eric's rule (Oct 18, Oct 25): home's options panel is
always there, greyed until a mode is picked, and home never moves". **Eric's order to delete the ⓘ is why its ⓘ lines go; the
rule it guards is untouched** (the panel there from the first view, its options greyed, none selected, not tappable, and every
box still, through every pick), and it measures one box more.

`e2e/home-ranked.spec.ts`
- "Eric's rule…" (the guard): the ⓘ's check "shown and not tappable" → removed (no ⓘ); the forced tap on the ⓘ and "the ⓘ's words
  stay shut" → removed; the steps "ⓘ open" and "ⓘ closed" → removed; the options `/^Solo you/` → `/^Solo$/` (the sub-label is
  gone); **added**: the line above PLAY (`.fd-hint`) is a box that stays within 1 px through every step (it moved with the line).
- "home keeps still": the steps "ⓘ open" and "ⓘ closed" → removed; `/^Solo you/` → `/^Solo$/`; the line above PLAY's box added to
  the boxes that must stay within 1 px; the panel-fit check no longer skips `.fd-types-info` (none exists); "the line under PLAY
  fits its room" → "the line above PLAY fits its room" (same check).
- "Other modes under PLAY…": Auto chess's text `…Build an army›` → `…Build an army` (no ›).
- "the RANKED row…": **one added line**, `await page.evaluate(() => document.fonts.ready)` before its check that the Boss Arena card's words
  are whole (`scrollWidth <= clientWidth`). The words no longer wrap (the CSS call above), so for the moment Archivo is loading, the fallback
  font's wider words run past their box and the check, made at once on a cold page, failed once in a full run at 320 px; the check itself is
  unchanged and now reads the page's own font. (Not a guard of an `eric.md` rule.) 16 of 16 passes after, at 4 workers.
- **New**: "home, said once" (phone 390×844 and 320×640; computer 1280×800, 1440×900 and 1280×680): no ⓘ; the options are titles
  only, ≥ 44 px, equal, side by side and fill the RANKED row's width; each pick's line is above PLAY, in one box that never
  moves, with nothing under PLAY; every card's picture is left of its words, level with the card's middle, its words whole on one
  line, the cards shorter (Boss Arena ≤ 64 px, the pair ≤ 57 px); PLAY taller (≥ 90 px phone, ≥ 72 px computer, ≥ 56 px in a
  short window); a phone fits with no scrolling and the last card's foot ≥ 24 px up; a computer's board stays.
- **New**: "test rank and level": a player sees "Weighty · 1580" and no ring or level; an admin sees "Opal III · 1580", "LVL 38" as wide
  as the icon, centered over it, the rating's gray and tiny, a thin green ring that starts at the top and runs clockwise to 3/4
  over a faint track (read from the path's own geometry); every box on home is the same for both within 1 px.

`e2e/matchmaking.spec.ts`, "home: Default, Bots off and Solo…"
- The ⓘ opened → "Default adds bots after 8 s to keep the wait short." and the ranking sentence → the line above PLAY reads
  "Starts within 8 s; bots fill any empty seats" (or the live wait), and there is no "About matchmaking" button (the ranking
  sentence moved to the FAQ: `faq.spec.ts` below).
- The ⓘ is at least 44 px wide → removed (no ⓘ). New: the three radios read exactly "Default", "Bots off", "Solo".

`e2e/home-layout.spec.ts`
- The computer's column: "PLAY, then the line under it, then Other modes" → "the line above PLAY, then PLAY, then Other modes": the modes
  right above the line (< 30 px), the line above PLAY (< 12 px), Other modes under PLAY (was: PLAY above the line, Other modes under
  the line).
- Phone fits: "the cards under PLAY's line" → "the cards under PLAY".
- "Other modes" card texts: `Solo Boss ModeAny boss, alone›` and `Auto chessBuild an army›` → without the ›.

`e2e/home-polish.spec.ts`, "phone home: one shadow…"
- "the line is a one-line `fd-hint-line`" → removed (that class, the old compensation, is gone); new: the line's text ends within
  8 px over PLAY.
- "the Other modes label 14 px under the line's text" → "14 px under PLAY" (same 14 px, Eric's approved spacing, from what is above it now).

`e2e/front-door.spec.ts`: the first test's title and one comment say "the line above PLAY" for "the line under PLAY" (no check changed).

`e2e/profile.spec.ts`, "your profile…": `switchesOff(page)` added at the start (a player's view; the checks "Weighty · 1612" are unchanged).

`e2e/faq.spec.ts`: **new**, "the FAQ's Your rating says when your ranking changes". `packages/app/test/faq.test.ts`: **new**, the same from the settings.

## Not done / for Eric's phone

- His real phone: the "LVL 38" label's room at the top of the pawn's card (above), and whether 97 px is the PLAY he wants.
- The real ranks and levels (Opal III and level 38 are placeholders).

## Later, Oct 28: room for "LVL 38", the tag closer to the pawn (Eric, from his phone)

- Eric: "LVL 38" was cut off at the pawn card's top edge. "All we need to do is drop the Opal 3 here in the text and just
  squeeze it closer to the top of the pawn … if we want to drop down the pawn as well a little bit more, like all of it, just
  a few pixels". (A first try shrank the pawn by 12 px to make the room; Eric wanted the tag lowered instead. Not shipped.)
- On a phone's home, the tag (icon, name, rank) sits 16 px lower and the pawn 4 px lower, at the same size. The card's inner
  box is 28 px at the top (was 12) and 8 px at the bottom (was 12), and the tag reaches 12 px into the pawn's box. That room
  over the pawn's head is kept for hats.
  - The tallest hat, the fire and ice crown, still clears the tag standing: 4 px at 390 × 844.
  - The tag is drawn in front of the pawn, so a hat rising in a hop passes behind the name.
- The short card (the tag beside the pawn) gets 6 px more at the top, from the pawn. The queue's card and the computer
  are unchanged.
- It's the same for every account, not only admins, so nothing moves when an account loads.
- The label's room under the card's top, after (before): 390 × 844, 16 px (0); 430 × 932, 25 px (9); 390 × 664, 16 px (13);
  360 × 640, 4 px (1).
- Guard: `home-ranked.spec.ts`, "test rank and level", now checks at four phone sizes:
  - at least 4 px of room above "LVL 38";
  - on the tall card, the tag at least 4 px over the top of the pawn's box, and in front of the pawn.
  - Both fail on the old layout.
