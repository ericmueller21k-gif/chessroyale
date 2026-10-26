# Home: Boss Arena, Solo Boss Mode and Auto chess (Eric, Oct 26, 2026)

Eric: "I wanna test a new menu where boss raid is replaced with Boss Arena and then Solo Boss Mode and AutoChess below
that." On the raid options (Join a raid, People only, Raid with bots, Play with friends): "remove the options, they will
now go all into a menu when you click on or stand by the coliseum as far as party and stuff." The solo boss mode "will
remain with the boss select screen we built." Boss Arena is the town square (`/town`); the Coliseum is where the raids go
when it's built (see `2026-10-26-boss-arena-and-rooms.md`).

## What changed (player-visible text, old → new)

- **Home, Other modes:** the **Boss raid** card ("Team up vs a boss · up to 50") → the **Boss Arena** card ("Party up with
  friends and take on the bosses", the rotating boss faces; it opens `/town`). A new **Solo Boss Mode** card ("Take on any
  boss alone") sits under it, then **Auto chess** (unchanged). Three cards, the same look and size.
- **The select screen:** its title **Boss raid** → **Solo Boss Mode** from home and the side menu. Under the tiles and the
  stage it shows only **Boss alone** (unchanged). Join a raid, People only, Raid with bots and Play with friends are not
  shown there.
- **The full old screen** (title "Boss raid", all five options) stays exactly as it was, but only for `?mode=raid` (the
  test link).
- **Side menu (computer):** **Boss raid** → **Boss Arena** (opens the town square), and **Solo Boss Mode** is added under
  it (opens the solo screen). Both use the crown icon.
- **FAQ, "Boss raid and Boss alone":** the "Where" sentence (tap Solo Boss Mode on the home screen; the raids with people
  are moving to the Boss Arena's Coliseum and aren't on the home screen for now), "Boss alone (on the Solo Boss Mode
  screen)", and "The Solo Boss Mode screen shows the boss you picked by its name".

## Judgement calls

- **Placeholder picture:** the Solo Boss Mode card shows the side menu's crown, drawn large in the card's gold (`CrownArt`,
  `styles.css` `.fd-crown`). Opus draws the real one later.
- **Side menu's Solo Boss Mode icon:** the same crown (Eric didn't name one).
- **Boss Arena's side-menu item never shows as the open page:** the town square is a full page with no side menu, so
  there is nothing to highlight. Adding a side menu to the town is not part of this change.
- **One prop for the two forms:** `HomeScreen`'s `full` (from App's `raidFull`). Every way into the raid screen sets it:
  `?mode=raid` sets it, the Solo Boss Mode card and the side menu clear it.
- **Raid kill switches** still apply to the full screen. The solo form only shows Solo's line.
- **The Boss raid stats tab** on the profile is still named "Boss raid": it's a stats tab, not the card or the menu item.
- **Tests:** `openBossRaid` (e2e/helpers.ts) now opens the full screen through `?mode=raid`, keeping the page's own switches.
  `openSoloBoss` is new; `bossAloneFromHome` goes through the Solo Boss Mode card, so the battle specs reach Boss alone the
  way a player does now.

## Consequence to watch

Until the Coliseum exists, players can't reach a raid from home: Join a raid, People only, Raid with bots and Play with
friends are only on the full screen (`?mode=raid`). This is what Eric asked for.
