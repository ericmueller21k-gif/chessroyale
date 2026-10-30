# chess.com's board habits on our board: arrows, square highlights and premoves (Oct 28, 2026)

Eric, Oct 28 (trimmed), "very high priority":

> we need to mimic how chess.com does … when you right click … draw arrows from pieces, like several, and then … click
> again to get rid of them. You can also … do like pre-moves, and then it'll like light up the square … and then the one
> that you're trying to pre-move to. But then if your opponent doesn't play the expected line … it just … gets rid of the
> colors … there's double pre-moves too … click on one of the tiles on the board and it just … changes colors and then
> stays the changed color until they click it again … we want it to look and feel like the chess.com with those features,
> so anyone who would ever play on both feels the same style of chessboard. That's going to be really important.

No platform named: premoves on a phone and a computer; arrows and squares are a mouse's (a right-click), so a computer's,
as on chess.com.

## What chess.com does, and what we matched

From support.chess.com ("How can I draw arrows on the board like streamers do?") and chess.com/terms/premove-chess:

| chess.com | ours |
| --- | --- |
| Right-drag from a square to another: an arrow; as many as you like; the same arrow again removes it | The same (another color over the same squares recolors it) |
| Arrow colors: plain yellow-orange, Ctrl red, Alt blue, Shift green | The same (⌘ counts as Ctrl on a Mac) |
| A knight's arrow is an L | The same: along its longer leg first, then the turn |
| Right-click a square: it fills red (Ctrl yellow, Alt blue, Shift green); again: off | The same |
| A left-click on the board clears every arrow and square; so does moving with the mouse | The same (a move starts with a left press) |
| Yours only | Only on this device, never sent anywhere |
| No browser menu over the board | `contextmenu` turned down on the board and whatever a screen draws on it |
| Premove: move while it's the other side's turn; the piece shows on its new square, both squares red | The same |
| Several premoves on the website, each from where the last leaves the pieces; one in the app | A computer (a mouse) lines up several; a phone (a finger) holds one, a new one taking its place |
| The first plays the moment your turn comes; an illegal one is cancelled with those after it, the colors gone | The same; the pieces go back at once |
| Cancel: right-click (website), touch anywhere else (app) | A right-click anywhere on the board; on a phone a tap anywhere but the second tap of a new premove |
| Where a premove may go: anywhere the piece's pattern reaches | chessground's premove destinations: a slider through pieces, a pawn's diagonal with nothing there yet, your own piece's square (it may be taken by then), castling while the FEN's rights hold and the rook is home |
| A premoved promotion | Our promotion picker as you make it (as for any move here; chess.com shows its picker too unless "always promote to queen" is on) |

**My own sense of it** (where chess.com does something small the brief didn't list):

- **The arrows' look:** a solid shaft 0.22 of a square wide with a flat triangle head 0.6 wide and 0.42 long, the tail a
  quarter of a square out from the piece's center, the tip on the target square's center; one color each, no outline,
  0.8 see-through for the whole arrow (shaft and head as one, so their join never shows darker), as chess.com's. While you
  drag, the arrow follows the pointer square by square, as chess.com's does. Colors: chess.com's own (`#ffaa00`,
  `#f8553f`, `#48c1f9`, `#9fcf3f`); the squares `rgba(235, 97, 80, .8)` red, `rgba(255, 170, 0, .8)` yellow,
  `rgba(82, 176, 220, .8)` blue, `rgba(172, 206, 89, .8)` green.
- **A premoved piece** is drawn as any piece on its new square (full color, no ghost), as chess.com does; whatever stood
  there is hidden under it. Its from and to squares are chess.com's premove red, `rgba(244, 42, 50, .55)`, over the
  last move's highlight. Selecting a piece for a premove shows the usual dots on every square it may premove to.
- **Layers:** your squares under the screen's own highlights (the last move, the Last Stand's mark), your arrows over
  the pieces and under the screen's arrows (power-up hints, the Last Stand's, Squads' picks), so a screen's arrows are
  never hidden by yours.
- **Every board drawn big gets arrows and squares,** interactive or not (replays, the history view, a boss's turn, the
  watching team's screen): one rule, and reading a position is where they help most. Not the small boards (mini boards,
  the live window, thumbnails).

**Checked on all three board colors and both themes** (stills in the PR): see "Board colors" below.

## Which modes premove, and why

Each screen opts in (`premove={{ key, side }}` on the board):

- **Ranked 1 v 1, the bot game and the town's bots** (`Duel.tsx`): in play, as chess.com.
- **A crowd's pick: a raid, Boss alone, a solo raid, the Crowd 50 v 50** (`Play.tsx` plays the premove as your pick
  opens; it's made on the boss's screen while he thinks and moves, on the watching screen while the other team chooses,
  or on your own turn's screen once your pick is in and the position shows the boss to move, Boss alone's). A premove
  there is your pick, made as your turn opens; with power-ups, the King and the rest as usual. Kept by the match, the
  board and your side, so it survives the screens in between; shown (not taken) on the crowd's reveal, which a tap skips.
- **Not while the opening plays out:** a premove made then waits for the first real turn (the board takes moves only once
  the screen makes it interactive, after the opening and the countdown; `e2e/opening-animations.spec.ts` unchanged).
- **Boss powers:** a premove the boss's power now refuses (a freeze, a crease, the saw, the dark, Smudgy's painted piece)
  is cancelled like an illegal one, and the dock says why, as for a move you tried (`onRefused`, `refused.ts`): a premove
  that silently vanished would read as a glitch.
- **Not Classic's rounds:** you move every round and the next round puts you on another board, so there's never a turn
  of the other side's to move ahead of (and a tap on Classic's reveal skips it). Not a **final** (its turns go round the
  team), **Squads** (picks with blocks and its own lobby; the board is ready for it when wanted), the **Hidden Boss's
  four boards**, votes or Auto chess.

## Fair play and the clocks

- **What a premove does to timing:** it plays the moment the turn opens, so its time is a round trip, not thinking. Fair
  play's timing signals are fast hard finds (a hard position's best in under 5 s) and how think time follows difficulty;
  a premoved hard find (a recapture you saw coming, say, in a position the crowd found hard) would count as a fast one.
  Its rules are "signals come from the server's own judged data, never numbers a browser makes up", so a plain "this was
  a premove" flag from the app would let a cheat flag every fast engine move and dodge the timing signals.
- **The rule** (the director's review of the PR, Oct 28): a pick is marked a premove only if the server had that move
  **before any browser could know the position it's played in**; a pick that misses this isn't punished, it's timed as
  every pick was before premoves.
- **What we did:** the app tells the lobby its first premove ahead (`premove`, as it changes), and the lobby keeps it only
  while the player can't pick (no round open in which they still have to), with the lobby's **premove seal** of the
  moment. The seal goes up each time the next position starts to be knowable to a browser: as a **round opens** (its
  position is out, and the watching team sees its picks live, the most popular one played) and at **every boss step**
  (`requestBoss` and the bounce, Alfil, hop, carrots, repaint, water, extra move and funhouse steps: the host's browser
  decides it, or the server does and shows it). The round a player next picks in takes their premove as it opens only if
  it was told under an older seal: before the last step that decided its position. A pick that plays that very move,
  says it's a premove and comes within `FAIRPLAY.signals.premoveMs` (2 s) of the clock's start is marked
  (`FairMove.premove`), and fair play leaves only its time out of timing; strength, evidence, streaks and the deep
  re-check judge it as any pick. No other change to how a game is judged. The review page shows "(premove)" by its time.
- **What that marks:** in a raid, a premove told before the host is asked for the boss's step (after your own pick, or
  during the crowd's reveal: the crowd's move is out, the boss's reply isn't decided); not one told while the boss thinks
  or while his move shows. In the Crowd 50 v 50, one told after your own pick, before the other team's turn opens (a
  computer's queue); not one told while they choose (their picks show live) or during their reveal. In a final, one told
  before the other finalist's turn opens; not one between movers. In Classic's rounds, none (the next round opens with
  nothing between). So most premoves made on the screen while the boss thinks, or while the other team chooses, are timed
  as any pick: the cost of never trusting the app, and no worse than before premoves.
- **Why not "a seal at the lock" (the review's first suggestion):** with seals at the lock and at the boss steps and "told
  before the latest seal", a premove told while the other team chooses in the Crowd would come before their lock and
  count, yet their picks show live to the watching team and the most popular is played, so the position is all but known
  then. Sealing as each round opens closes that; in a raid it changes nothing (the boss step is the latest seal either
  way). A seal is never added for a step that reveals nothing new (a boss request sent again to a new host), since a
  later seal lets through what was told before it.
- **1 v 1:** no judged picks, so no timing signal; nothing marks a premove there (a field nobody reads). The clock is
  unchanged: the server charges each move the time from the opponent's move reaching it to yours reaching it, so a
  premove costs about a round trip (chess.com charges 0.1 s); the bot game, on the device, about a frame. Ranked's rules
  and ranks are untouched.

## Settings

Settings → Board: **Premoves** (on) and **Arrows and highlights** (on; greyed on a device without a mouse), per device
(chess.com has both switches). Switching Premoves off cancels every premove waiting.

## Board colors

Every new color was looked at on Classic, Green and Gold, in light and dark (the board's squares don't change with the
theme, only what's around it), in stills of every arrow and square color and of two premoves on each. Classic reads with
chess.com's colors as they are. Two collided with a scheme's own squares and got their own rule under it (styles.css,
"Your arrows, highlights and premoves"), as Alfil's glow did:

- **Green:** Shift's green square and arrow were close to the green squares: a deeper green there (`rgba(64, 140, 36,
  .8)`, `#3f9a22`).
- **Gold:** Ctrl's yellow square and the plain arrow's yellow-orange were close to the gold squares: a deeper orange there
  (`rgba(240, 118, 0, .8)`, `#f07a00`).

The premove red reads on all three as it is.
