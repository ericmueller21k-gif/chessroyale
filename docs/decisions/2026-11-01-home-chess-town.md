# Home: Chess Town, the new pictures, your ride on the home pawn, the gambling warning (Nov 1, 2026)

Eric (Oct 31 to Nov 1), from his mockup (both pictures, phone and computer): the Boss Arena card becomes a **Chess Town** button under PLAY, a little
town scene with the name over it; "go with both, just have a 50% chance of each one every time u load"; the crest is the side menu's icon; Boss
Battle and Auto chess take their new pictures; and, having equipped Riding Chirp, "it doesn't show on the main page on desktop". The crate
page gets a small gambling warning (he approved the wording). Area: [hub.md](../areas/hub.md), [shop.md](../areas/shop.md).

## What changed

- **Boss Arena is Chess Town** everywhere a player sees it: home, the computer's side menu, the FAQ. (The internal names `bossArena` and
  `onBossArena` are `chessTown` and `onChessTown` too.)
- **Home's order:** PLAY, Chess Town's button (PLAY's exact size), Other modes, Boss Battle and Auto chess side by side. The full-width card is gone.
- **The button** is the town picture playing its idle with "CHESS TOWN" in big white letters with a dark outline over it; A (the skyline) or B (the
  square), picked at random as the page loads. **The crest** is the side menu's Chess Town icon (not on the button); Boss Battle keeps its crown there.
- **Boss Battle's card** has the rotating boss faces (from the old card, its crown gone); **Auto chess's card** has the army (the knight gone).
- **Your ride on home:** the big pawn, your ring and the side menu's Profile item ride the ride you wear, its idle playing, in the same boxes.
- **The crate pages' gambling warning:** a small red ring, hollow in the middle, a solid red "!" in it, top right of the Crates tab and of each
  crate's page; a tap opens "Crates are chance, like gambling. Only spend money you're okay losing." with a Close button.

## Calls made

- **The same size as PLAY by the same rules, not the same class.** `.fd-town` is in every one of PLAY's size rules in `styles.css` (97 / 76 / 60 px), so
  the two never part; it isn't `.fd-play`, because the specs and the code read "the" `.fd-play` (one per page, PLAY) by that class.
- **50/50 once a page load** (`TOWN_PICTURE`, `home-art/town.ts`), not each time home shows, so the picture doesn't change under you as you go
  into a game and back. `?town=A` or `?town=B` forces one (stills, tests); it only picks between two drawings, so it isn't a gated test switch.
- **The pictures are the API's drawings, copied as drawn** (`home-art/arena-*.ts`, only their two import lines changed; source:
  `origin/claude/boss-art`, `scripts/boss-art/out/<name>/`). The mockup's player was rewritten: a picture is drawn only when its frame changes
  (4 to 5 times a second, not every animation frame), is still on its first frame under reduced motion, and its size math is a tested pure
  function (`home-art/layout.ts`, `packages/app/test/home-art.test.ts`).
- **PLAY and Chess Town give the room back together where there is none.** The button is PLAY's size, so it's 33 px taller than the card it replaced
  on a phone (97 against 64) and 12 px on a computer (76 against 64). At 390 × 844 and 1440 × 900 that costs nothing (the pawn's card takes it; the live
  window's board is already at its 233 px cap). But a phone 640 px tall had its pawn's card at the minimum already (home would scroll by 29 px at 360 × 640),
  and a 1280 × 800 laptop's live board would be 12 px smaller. Rather than scroll, or shrink the board, **both buttons share one height that eases down
  on a short screen**: a phone under 700 px tall, 97 px to 80 px at 666 px and below; a computer window under 812 px tall, 76 px to 70 px (a short laptop,
  under 761 px, is the 60 px it was). Always the same as each other, so "exactly PLAY's size" holds at every width and height. Eric can ask for the
  other way (full-size buttons, the page scrolling or the board a little smaller) if he'd rather. Measured: phone 360 × 640, 375 × 667, 390 × 664 and
  up, no scrolling; 1280 × 800 the board 233 px as before; 1440 × 900, 390 × 844 and 1920 × 1080 unchanged (97 / 76 px).
- **The sky is fixed** (the pictures' dusk), the same in the light and dark themes; the gold ring is the other cards'.
- **The words** are "Chess Town" in the page, uppercased by the stylesheet (a screen reader says it as a name); smaller (28 px) at 320 px wide so they stay whole.
- **The ring on your ride "came for free":** the same `ride` the profiles use, on your ring and the menu's Profile item as well as the big pawn.
  Not the queue's and Squads' cards or a match's screens: still the pawn alone, as the rides note says.
- **"The crate page" is both:** Eric didn't say whether he meant the Crates tab or a crate's own page, so the one ring is on both (the same
  component, over the page's corner, out of the flow). It isn't on the opening or the reveal.

## Checks

None guards a rule in `docs/rules/eric.md`: `e2e/home-ranked.spec.ts`, "Eric's rule (Oct 18, Oct 25)…", is untouched and passes as it was (its `.rd-card` box
is now Boss Battle's, still measured before and after every tap). The checks that named Boss Arena or its card were updated to Chess Town's button and the
two cards (listed old → new in the PR). New: `packages/app/test/home-art.test.ts` (the 50/50 pick, `?town=`, the scene's whole-pixel layout, the
drawings' frames), `e2e/profile.spec.ts` "rides on home (Nov 1)…", `e2e/crate-banner.spec.ts` "the gambling warning's red ring…".
