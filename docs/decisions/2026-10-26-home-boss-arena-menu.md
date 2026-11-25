# Home: Boss Arena, Solo Boss Mode and Auto chess (Eric, Oct 26, 2026)

Eric: "I wanna test a new menu where boss raid is replaced with Boss Arena and then Solo Boss Mode and AutoChess below
that." On the raid options (Join a raid, People only, Raid with bots, Play with friends): "remove the options, they will
now go all into a menu when you click on or stand by the coliseum as far as party and stuff." The solo boss mode "will
remain with the boss select screen we built." Boss Arena is the town square (`/town`); the Coliseum is where the raids go
when it's built (see `2026-10-26-boss-arena-and-rooms.md`).

## Layout (Eric, Oct 26, the decision after the first build)

- **Boss Arena:** a full-width card on top.
- **Solo Boss Mode and Auto chess:** side by side under it, half width each, on a phone and a computer alike.
- The two rows together are as tall as today's two cards on a phone (84 px each, 10 px apart), so home fits without
  scrolling at every phone size the fit test checks (360×640, 375×667, 390×664, 390×844, 430×932).
- The half cards keep the `rd-card` look: the picture on top, the name, one short line, and the › in the top corner.

## What changed (player-visible text, old → new)

- **Home, Other modes:** the **Boss raid** card ("Team up vs a boss · up to 50") → the **Boss Arena** card ("Party up and
  take on the bosses", the rotating boss faces; it opens `/town`). A new **Solo Boss Mode** card ("Any boss, alone") sits
  half width under it, beside **Auto chess** (its line "Build an army, watch it fight" → "Build an army").
- **The select screen:** its title **Boss raid** → **Solo Boss Mode** from home and the side menu. Under the tiles and the
  stage it shows only **Boss alone** (unchanged). Join a raid, People only, Raid with bots and Play with friends are not
  shown there.
- **The full old screen** (title "Boss raid", all five options) stays exactly as it was, but only for `?mode=raid` (the
  test link).
- **Side menu (computer):** **Boss raid** → **Boss Arena** (opens the town square), and **Solo Boss Mode** is added under
  it (opens the solo screen). Both use the crown icon.
- **Town square, Boss Alone:** a boss's "Challenge alone" opens the Solo Boss Mode screen (the solo form), that boss's tile
  picked (it used to open the Boss raid screen).
- **FAQ, "Boss raid and Boss alone":** the "Where" sentence (tap Solo Boss Mode on the home screen; the raids with people
  are moving to the Boss Arena's Coliseum and aren't on the home screen for now), "Boss alone (on the Solo Boss Mode
  screen)", and "The Solo Boss Mode screen shows the boss you picked by its name".

## Judgement calls

- **Placeholder picture:** the Solo Boss Mode card shows the side menu's crown, drawn in the card's gold (`CrownArt`,
  `styles.css` `.fd-crown`). Opus draws the real one later.
- **Half cards stack their parts:** a name like "Solo Boss Mode" doesn't fit half a 320 px phone beside a picture, so the
  picture sits on top. The name is 13 px on the half cards so it stays on one line at 320 px.
- **Side menu's Solo Boss Mode icon:** the same crown (Eric didn't name one).
- **Boss Arena's side-menu item never shows as the open page:** the town square is a full page with no side menu.
- **One prop for the two forms:** `HomeScreen`'s `full` (from App's `raidFull`). Every way into the raid screen sets it:
  `?mode=raid` sets it, the Solo Boss Mode card, the side menu and the town's Boss Alone clear it.
- **Raid kill switches** still apply to the full screen. The solo form only shows Solo's line.
- **The Boss raid stats tab** on the profile is still named "Boss raid": it's a stats tab, not the card or the menu item.
- **Tests:** `openBossRaid` (e2e/helpers.ts) now opens the full screen through `?mode=raid`, keeping the page's own switches.
  `openSoloBoss` is new; `bossAloneFromHome` goes through the Solo Boss Mode card, so the battle specs reach Boss alone the
  way a player does now.
- **Computer:** the half cards are 84 px tall (the Boss Arena card 64 px), so home is about 20 px taller on a computer than
  with the two cards it replaces. Home has no fit check on a computer.
- **Short phones:** at 320×568 (not one of the fit test's sizes) home scrolls by about 66 px; the two-card layout it
  replaces is the same total height.

## Consequence to watch

Until the Coliseum exists, players can't reach a raid from home: Join a raid, People only, Raid with bots and Play with
friends are only on the full screen (`?mode=raid`). This is what Eric asked for.

## PLAY and the "Other modes" label (Eric, Oct 26, second round)

- **"The play button is too small."** PLAY is 64 px tall on a phone and a computer (was 43 px on a phone, 59 px on a
  computer), as tall as the Other modes cards. Its label is 30 px on a phone (was 24 px) and 36 px on a computer (was 32).
  It stays full width and dimmed until a mode is picked (Eric's home rule).
- **Short screens:** on a computer's window under 760 px tall, PLAY is 48 px (was 43 px) with a 28 px label (was 26 px):
  the most the live window's board can give up at 680 px tall (it must stay over 150 px). Nothing on a phone needed a
  floor: the room came from spacing.
- **Computer half cards** lie flat (picture beside the words) at the Boss Arena card's 64 px, so the computer's home is
  no taller than with the two cards they replace, and the live window keeps its board (over 230 px at 1280 × 800).
- **Room for it, on a phone:** the column gaps went from 10 px to 8 px, and the top and bottom padding from 12 px and 14 px
  to 10 px each. That is 22 px saved; the label gets back 2 px of top margin so it stays 14 px under the hint line (Eric's
  approved spacing). The fit test's sizes are unchanged: 360×640, 375×667, 390×664, 390×844 and 430×932 all scroll 0 in
  every mode, and the pawn stays at 52 px or more.
- **"Other modes":** centered over the cards (text-align: center; the 4 px left padding is gone).
- **Not fitting:** 320×568 (not one of the fit test's sizes) still scrolls, by about 65 px (it was about 66 before).
  A computer's 1024×768 scrolls by about 124 px; there is no fit check there.
