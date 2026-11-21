# Shared tower floors: every boss's moments audited (Nov 21, 2026)

Eric's stack of Battle Tower bugs, Nov 21 (the brief: `notes/briefs/tower-shared-anim-audit.md` on `claude/director-notes`):

- Desktop, floor 6, Jefferson + Smudgy, Jefferson's candle: "he's showing twice here, so we may have some bugs where in the battle
  tower, when bosses are doing animations, there may be some more of these bugs."
- Same floor: "it's not showing the Roman candles anywhere on his turn or on Smudgy's turn. I don't see where the normal count is that
  we have."
- The installed desktop app, about 1880 x 1025: "remember our rule, there's never supposed to be a scroll bar for this ... we have to
  scroll to see the full board and everything. It's not resizing".
- Computer, Folio beside the board: "your birds are getting cut off a bit at the top. So again, it looks like these boxes weren't built
  properly to factor in for the slight movements that some of these characters have."
- Computer, floor 7, Hollow + Folio, the God King's move: "when I use a God King move ... it makes whosever turn it is, it makes the
  other one disappear."
- The split bar, Hollow's part dimmed: "we shouldn't be darkening whichever boss's turn it's not, because ... I can barely see even
  bulbs here ... it's fine to put something like that yellow that says to move, but ... we don't want to do that [the darkening]."

## How the audit was run

A scratch probe (not committed) entered a real floor through the town (the e2e flow: the clerk, a run set in the local database) for
every boss, paired so each boss's ultimate came at once (`?power=<ultimate>`; the passives come on their own), phone (iPhone 13) and
computer (1280 x 800), six of your moves with the God King's move on the 2nd and his strike on the 4th, and one floor of three
(Hollow, Folio, Jefferson). Every animation frame a moment showed (`.power-moment`, `.king-command`, `.king-summon`), it noted each
boss's figure (a phone's in his part of the bar, a computer's beside the board and in the bar): drawn, dimmed or missing, and whether
the moment drew its boss somewhere else (`.pm-caster`, `.boss-moment`). Timber, Dash, Don Dough and Chandy are admins-first
(`BOSS_ADMIN_FIRST`), so they ran as an admin (as Eric sees them). Lone battles were the reference: a phone's bar figure hides for
every moment its boss casts at the board's corner; a computer's figure beside the board hides only while the moment draws him on
the board (styles.css, `.pm-caster`).

## What it found (before the fixes), by class

| Class | Where | Before | After |
| --- | --- | --- | --- |
| A boss's own moment drew him twice | phone: **every** boss's cast moments (his figure stayed in his part while he cast at the board's corner); computer: the moments that draw him on the board: Jefferson's candle, Big Boy's bounce and snack, Boingo's funhouse, Sawyer's board saw, Wrangler's pull, Moo's Full Moon, Hollow's Lights out | bug | fixed (`.tw-casting`) |
| The God King's move and strike hid the other bosses | computer: every floor (the reveal screen drew the lone figure of the boss in focus); phone: fine (the bar stays) | bug | fixed (Crowd.tsx) |
| The reveal screen dropped the other bosses' marks and the hearts | every floor, during your move's reveal and the God King's moments | bug | fixed (Crowd.tsx) |
| The boss not to move dimmed | every floor, both | bug (Eric's call) | fixed (no dim) |
| Figures clipped by their box | every boss but Babur's pump's box: 17 of 18 had idle frames outside the box measured from the first frame (Boingo, Wrangler, Sawyer, Dash, Folio, Big Boy, Timber, Moo, Smudgy, Chub & Chirp, Babur, Alfil, Ginger, Puddles, Chandy, Jefferson, the Hidden Boss); tower only (a lone battle's figure box doesn't clip) | bug | fixed |
| The page scrolled on a computer | every tower floor (one boss too), height-bound windows: 1366 x 768 (+16 px), 1440 x 900 (+4), 1600 x 900 (+20), 1741 x 980 (+20), 1880 x 1025 (+15); 1280 x 800 and phones fit | bug | fixed |
| Bar props not drawn | Jefferson's candles, Hollow's bulbs (his life strip), Timber's workshop, Dash's tally, Don Dough's timers | missing | **left** (below) |
| The cast animation in place | computer: a boss who casts where he stands (Ginger's freeze, Folio's draft, Babur's hoops, …) plays his cast animation on a lone battle's figure; the tower's side figures idle through it | gap | **left** (below) |

Per boss and power (phone / computer, after the fixes; "drawn elsewhere" moments hide only that boss's own figure, the others stay):

| Boss | Passive | Ultimate | Phone | Computer |
| --- | --- | --- | --- | --- |
| Ginger | freeze | blizzard (thaw: `pm-stay`, he stays) | ok | ok (casts in place: idles, see "left") |
| Boingo | pie | funhouse | ok | ok (funhouse: drawn once) |
| Jefferson | sparkler | candle | ok | ok (candle: drawn once); candles not shown (left) |
| Hollow | dark | Lights out | ok | ok (Lights out: drawn once); bulbs not shown (left) |
| Big Boy | blocks, snack | bounce | ok | ok (bounce, snack: drawn once) |
| Sawyer | cuts | board saw | ok | ok (board saw: drawn once) |
| Wrangler | pull | (no ultimate on a shared floor) | ok | ok (pull: drawn once) |
| Alfil | tusks | slam, fuse | ok | ok |
| Chub & Chirp | leapfrog | carrot patch | ok | ok |
| Smudgy | camouflage | repaint | ok | ok |
| Moo & Moon | moonbeam | Full Moon | ok | ok (Full Moon: drawn once) |
| Puddles | seeds | water | ok | ok |
| Babur | balloons (pump) | hoops | ok | ok |
| Folio | draft | crease, fold | ok | ok |
| Timber, Dash, Don Dough, Chandy | (admins first) | | not met: the server deals them to its own admins only, and the e2e seat isn't one | the same fixes apply (they read the caster's id, every boss alike); their props are left (below) |
| The God King | move, strike | (no Last Stand on a floor) | ok | ok |

(Every row's "ok" is the probe's: no boss missing in any frame of a moment, the caster's own figure hidden exactly while the moment draws
him elsewhere, nobody dimmed. The four admins-first bosses can be run the same way once the e2e has a server admin's tower seat.)

## The fixes (one shared fix per class)

- **Drawn once** (`TowerBar.tsx`, `Boss.tsx`, `tower.css`): the boss screen passes the moment's caster (`casterOf`; a moment drawn
  outside the moments' list, Lights out or the snack, is the boss to move's) to the split bar and the side figures, which mark his part
  and his figure `.tw-casting`. The lone battle's own rule, applied to his figure only: hidden (never removed: his box keeps its size
  and place) on a phone for every moment he casts, on a computer while the moment draws him on the board (`.boss-moment`, the Full
  Moon). Every other boss stays drawn.
- **The God King's moments** (`Crowd.tsx`, the reveal screen your move and the God King's play on): `SideFigures` (every boss, as the
  play and boss screens draw them) in place of the lone boss's figure; every boss's board layer (`partsOf`), not the one in focus;
  the hearts beside the board (`TowerBoardLives`).
- **No dimming** (`tower.css`): the dim rules of the parts and the side figures removed; the yellow outline and TO MOVE mark the boss
  to move, as Eric asked. (A boss's own state stays shown as it is: Wrangler's empty meter, Babur's pump OFF.)
- **The board's room** (`board-size.css`): a tower floor's strip line (36 px, less the 8 px gap it takes back) counts in the boss
  screen's room (`--bd-room` 123 → 151 px with `.tw-strip-line`): the board is 28 px smaller where the window's height bounds it, and
  nothing scrolls.
- **Figure boxes** (`TowerBar.tsx` `drawnBox`): the union of every frame of the animation drawn in the box (his idle: a bob, a wing's
  flap), not its first frame; worked out once a boss, so the box keeps one size.

## Left for a next PR

- **Every boss's bar prop on a shared floor** (Jefferson's candles, Hollow's bulbs, Timber's workshop, Dash's tally, Don Dough's
  timers). The parts have little room (a phone's part of two is about 190 px wide with 46 px beside the figure; of three, about 35 px),
  so this is a new look: mockup first (CLAUDE.md). The proposal: on a computer, each prop in its boss's part of the split bar at the
  part's right, where a lone computer bar draws it (the room beside a figure by the board is about 30 px); on a phone, the part's
  free corner left of the figure (where Babur's pump is), each prop at a compact scale, or a line under the meters where it can't fit.
- **The cast animation in place on a computer** (the caster's side figure plays his cast as a lone figure does: `InPlace`).
