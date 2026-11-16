# Home keeps still: one fixed panel, the phone's order on a computer (Oct 18, 2026)

Eric, Oct 18, on a computer: "It's resizing on the desktop just from clicking different buttons… these things should be
like a given." Then, with phone screenshots: "every mode, there should be a text box, kind of like how we already
have, but it should never change size, and it should be dedicated to whatever text we need there to explain what that
is, or if there needs to be options for it … nothing should actually be forced moving around the size of the board or
where the play button is. Like, those things need to be static." Lane: `hub`. Area page: [hub.md](../areas/hub.md).

## What was wrong

Under the RANKED row, home showed a different thing per pick, each its own height, and the line under PLAY wrapped to
one or two lines by mode. On a computer the live window (the board preview) takes whatever room the column leaves, so
every change of height resized the board; on a phone it moved PLAY and everything under it. Measured on main
(Chromium; the computer's column is 320 px wide at 1280 px, 360 px from 1440 px):

| Click (from 50 v 50, Default) | 1440 × 900: board | 1440 × 900: PLAY | 390 × 844: PLAY |
| --- | --- | --- | --- |
| Default (start) | 262 px | y 632 | y 612 |
| Bots off (its ⚠ warning) | 178 px | y 632 | y 697 (+85) |
| ⓘ open (its words pushed in) | 126 px | y 632 | y 748 (+136) |
| 1 v 1 (rank line, no Matchmaking row) | 315 px | y 632 | y 559 (−53) |
| Squads (Party box, a two-line line under PLAY) | 252 px | y 620 (−12) | y 610 |

The same at 1280 × 800 and 1920 × 1080 (1280 × 800: the ⓘ hid the board altogether). The full "before" boxes (board,
mode row, option row, Boss raid card, PLAY, the line, after every click at 1280 × 800, 1440 × 900, 1920 × 1080 and
390 × 844) are in the PR.

## What changed

- **One panel** sits between the RANKED row and PLAY: one box, one fixed height (58 px), the same for every mode on
  every layout. It holds the pick's options or words:
  - **50 v 50:** Matchmaking (Default, Bots off, Solo) and its ⓘ, as before.
  - **1 v 1:** your rank ("Your rank: Placement 0/5") over what 1 v 1 is ("Ranked chess vs one player near your
    level", moved up from the line under PLAY). Words read better than three greyed-out options that don't apply: the
    panel then explains, as Eric allowed ("it can either… be grayed out, or it can provide information").
  - **Squads:** **Solo queue** or **Party**, a radio pair in the Matchmaking row's shape. Solo queue is picked at first
    (PLAY is the solo queue, as before). Party opens the party sheet at once, as the Party box did (one tap, as
    before), and stays picked, so PLAY opens the sheet too. Not remembered on the device: a visit starts on Solo queue.
- **The ⓘ's words float** over the RANKED row (a popover above the panel) instead of pushing the page down.
- **The Bots off warning is gone** (Eric: the ⓘ explains it). The line under PLAY still says "People only: starts when
  100 have joined".
- **The line under PLAY has a fixed height:** two lines' room on a phone, one line on a computer. Squads' two lines are
  shortened so every line fits a 320 px column on one line.
- **The computer's column has the phone's order** (Eric: "It should be like the phone"): the RANKED row, the panel,
  PLAY and its line, the Boss raid card as a full-width bar, Play with friends on its own row (where the phone puts it,
  under the card). This reverses the computer's "PLAY at the bottom" (Eric, Oct 9) on Eric's own word. To keep the
  board preview big with the two extra rows: the column's gaps are 12 px (16 before), the card stays its shorter
  computer size (64 px), the column may use up to 760 px of height (720 before), and in a short window (760 px tall or
  less) the column closes to 8 px gaps and PLAY to 64 px.

## Player-visible text (old → new)

- Bots off's warning "⚠ No bots can mean a much longer wait: the match starts only when 100 people have joined. You can
  switch to Default from the queue." → removed.
- Squads' Party box "Party / Play with up to 3 friends in one squad · create one or join by code" → the panel's two
  choices "Solo queue / you join a squad" and "Party / with up to 3 friends".
- Squads' line under PLAY "Solo queue: you join a squad of 4 · bots fill any empty seat after 60 s" → "Solo queue: bots
  fill any empty seat after 60 s"; with Party picked: "Party: create one or join by code" (new, from the old box's words).
- 1 v 1's line under PLAY "Ranked chess vs one player near your level" → moved into the panel, under "Your rank: …";
  the line under PLAY is empty for 1 v 1 (it keeps its room).

## Tests

`e2e/home-ranked.spec.ts`, "home keeps still": phone (390 × 844, 320 × 640) and computer (1280 × 800, 1440 × 900,
1920 × 1080), it clicks every mode and option (Default, Bots off, Solo, the ⓘ open and closed, 1 v 1, Squads, Party and
its sheet, Solo queue, 50 v 50) and asserts the board preview's, PLAY's, the Boss raid card's and the panel's boxes stay
within 1 px, and that the line under PLAY fits its room. It fails on main (Bots off moves PLAY and shrinks the board)
and passes with this change. The specs that pinned the old order or the Party box (home-ranked, home-layout,
live-window, front-door, matchmaking, squads-play, kill-switches) follow the new layout.
