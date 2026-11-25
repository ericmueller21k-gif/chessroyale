# The Boss raid screen as an old-school character select; home's card turns (Oct 16, 2026)

Eric, Oct 16 evening. Lane: `characters` (the director's brief). Area pages: [bosses.md](../areas/bosses.md),
[hub.md](../areas/hub.md).

## What Eric asked for

"Old school Street Fighter 2 style, like typical character select screen, like, you know, almost like PlayStation
era… their icons would be… slanted squares, they're not just all perfectly lined up, so it kind of creates this cool
like tile effect with all the bosses. So then all the bosses are at the top, and then the current boss that's
selected, kind of how we have the pawn thing happening in the 1v1, same idea. So now it shows their full sprite…
below the character select… standing there doing its idle animation… you pick a character, it'll show his animation,
his name, the rating." And the play options move under it ("we'll have to kind of update that screen anyway").

## What it is

- **Tiles** (`components/BossSelect.tsx`): a parallelogram per boss you can meet, cut with `clip-path` (so nothing
  sticks out sideways: no horizontal scroll at 320 px), each with its portrait (`BossFace`, the boss menu's). Then the
  Hidden Boss's tile, dark, his portrait a black silhouette edged in violet, and "?" for a random boss. Five to a row
  on a phone (the second row centered under the first, staggered), all nine in one row from 600 px. The picked tile is
  gold. A radio group ("Bosses"), each tile a radio named for its boss ("Locked boss" for the Hidden Boss, "Random
  boss" for "?").
- **The stage:** the 1 v 1 versus stage's platform (`dv-st-plat`, reused as is) and its soft light, the picked boss on
  it in its idle animation (`SpriteAnim`, the shared animation loop: one sprite animating, resting while the app is
  hidden), its name, and its strength against you: skulls and "Rating N", worked out as the boss menu does
  (`bossStrength(raidBossElo([your rating]), boss)`: a step above your rating plus the boss's own offset; no difficulty
  on top). Every boss is drawn at one pixel size (0.8 % of the stage's width a sprite pixel), so a bigger boss stands
  taller, as on an old select screen; one taller than the stage allows (the Hidden Boss) is drawn smaller, and one
  wider than it (Wrangler's lasso) slides over to stay whole (`placeOnStage`, from the idle's first frame).
- **A tap:** the boss drops onto the stage with the 1 v 1 opponent's drop and settle (`dv-st-drop`, no new art), its
  sound plays once (`play`, so the mute switch holds) and it says a line in its speech bubble (the battle's `bc-bubble`
  and speech rule, in a voice of its own: a tap's line replaces the last). The bubble has a room of its own over the
  stage, so it never covers the boss. Tapping the picked tile again plays it all again.
- **"?":** a big gray "?" on the platform, "Random boss", "A different boss from last time". No sound or line (no boss
  to speak). The real boss is chosen as the game starts, as before (avoiding the one met last).
- **Reduced motion:** the boss is a still (its idle's first frame) and nothing drops; the card doesn't fade.

## The sounds (one each, its most iconic, from its own pack)

| Boss | Sound | What it is |
| --- | --- | --- |
| Ginger | `gingerCrackle` | her freeze, the ice cracking over a piece |
| Boingo the Clown | `clownSplat` | his pie landing |
| Jefferson | `grexFizz` | his sparkler's fizz |
| Hollow | `hollowCast` | the darkness pouring out of him |
| Big Boy | `bigboyClack` | a toy block landing |
| Sawyer | `sawyerRev` | his saw revving |
| Wrangler | `pigWhirl` | his lasso whirling |
| the Hidden Boss | `recluseHum` | his stare's low hum |

They're made ahead in the sound worker as the screen opens (`warmSounds`), so a tap never waits on one.

## The lines

Existing lines only, until Eric approves new ones: from each boss's kit, only those that read right outside a match
(nothing about a move, a capture, a power, the board or the crowd), mostly their entrances. One at random a tap, never
the same twice running. The table is `SELECT_LINES` in `characters/boss-select.ts`: an approved set replaces a boss's
list there in one edit. The drafts from each boss's lore (Hollow's is Eric's own; the rest are sketches drawn from what
the game already shows of them) are in the PR, for Eric.

## The Hidden Boss

- His tile is dark (a silhouette, no portrait details). Picked, the stage draws his sprite and idle all black, edged
  in violet; the name reads "???", the line under it "Locked"; his low hum plays; his bubble says Eric's two lines in
  turn: "Team up on me. It wouldn't be the first time anyone did that." (Eric's, word for word) and "You're not ready to
  fight me yet."
- Every way to play is locked while he's picked: grayed out, a small lock by each name. Nothing ever starts against
  him from here, and his pick is never stored.
- His name is in no text, label or attribute of the screen (a test reads the page). His rules hold in his lines: no
  country or its people, nothing about Korchnoi, and both are original lines (no quote reworded).
- An admin still meets him in Boss alone from the hidden `/bosses` picker (below), as before.

## The ways to play, under the stage

| Choice | Line under it | The boss |
| --- | --- | --- |
| Join a raid | "Random boss · up to 50 players · bots after N s" | always random (a public queue: the lobby is shared) |
| People only | "Random boss · no bots · starts at 50, or 10 after N s" | always random |
| Raid with bots | "You and 49 bots · starts at once" | the pick (`bossId` of the Solo raid; it was always random) |
| Boss alone | "Just you vs this boss" ("Just you vs a random boss" with "?") | the pick |
| Play with friends | "Make a raid and share its code, or join one" | the pick (the creator's: the lobby's `bossPicked`) |

A guest's online choices still read "Online: sign in to play". While a 1 v 1 search runs, each still asks "Leave the
1 v 1 queue?" first (App's `leavingDuelFirst`, unchanged: the choices call the same handlers). Under them, the screen's
one line from before: "Up to 50 of you pick the crowd's moves together against a boss. The most popular pick is
played."

- **Boss alone's menu** ("Boss alone") keeps the difficulty (and an admin's brain picker) and has one row: the boss
  picked on the tiles (or "Random boss"), a tap starts. Picking the boss again from a list would have been a second
  pick for the same thing.
- **Play with friends → Create a raid** makes the raid at once for the pick (it used to open the boss menu first).
  Maia's files are fetched ahead there when this device may host the boss's brain, as the menu did.
- **A Solo raid** now meets the boss picked, as Boss alone does (`overridesFromUrl`: `bossId` is the pick for both); its
  strength is still matched to you with no difficulty on top.

## Resting bosses

A boss switched off by its kill switch (`PAUSE_BOSS_<ID>`) has no tile, as the boss menu has always left it out (my
call: consistent with the rest of the app, and the stage never shows a boss you can't meet). A stored pick of one reads
as random until it's back. The Hidden Boss's tile goes the same way if he rests.

## `/bosses`

Still opens the solo boss picker at once, over home, as before ("Choose your boss": every boss you can meet and a
random one, the difficulty; for an admin the Hidden Boss after them). My call: kept rather than opening the new screen,
because it's where an admin meets the Hidden Boss now that his tile is locked, and the e2e suite's admin battles
against him start there. Its pick is remembered as the Boss raid screen's.

## Home's Boss raid card

- A still portrait (`BossCardFace`), turning to the next boss you can meet every 30 s (`FRONT_DOOR.bossCardMs`), the new
  one fading in over the last in 0.6 s (`bossCardFadeMs`), in the same fixed box: the card never changes size. Never
  the Hidden Boss, never a resting boss; roster order. No idle animation, no lines.
- It waits while the app is hidden (its timer starts again when it's back); under reduced motion the new one replaces
  the last without a fade. Test switch `?cardMs=` for a quicker turn.
- **Shelved, a later idea:** the card itself animated, the boss in its idle, saying lines. Simple beats flashy for
  now (Eric, Oct 14): one sprite animating on screen, on the screen meant for it.

## Tests

- `e2e/boss-select.spec.ts`: the tiles, a tap's drop, sound (`__soundLog`) and line for Boingo, Hollow and Ginger; "?";
  the Hidden Boss dark, his hum, his two lines in turn, every choice locked, his name nowhere in the page; muted (the
  sound logged as muted, the line still shown) and reduced motion (a still, no drop); the pick reaching Play with
  friends (`boss=` on the new raid), a Solo raid and Boss alone (the battle's boss), the public queues' "Random boss";
  a resting boss (`/api/status` faked) with no tile; the layout at 320, 360, 390 and 1280 px (rows, order, every boss
  whole on the stage, no sideways scroll); home's card turning (`?cardMs=1000`) through the bosses in order, never the
  Hidden Boss, its size fixed, no animation loop.
- `packages/app/test/boss-select.test.ts`: every boss with a tile has a sound from its own pack and lines; the lines are
  its own (the Hidden Boss's, Eric's); none twice running; his in turn.
- Updated for Boss alone's menu and `/bosses`: `home-ranked`, `boss-character`, `eval-bar`, `formats`, `maia`, `recluse`,
  `perf` (his phase 2's perf run), `test-switches`; the frame scripts (`frames:character`, `frames:boss-move`,
  `frames:flash`, `frames:wip`) start from `/bosses`.
