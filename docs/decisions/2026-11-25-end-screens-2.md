# End screens, round 2: every mode tighter; ranked 1 v 1's end page is its game screen (Nov 25, 2026)

Eric (Nov 25, phone and computer screenshots): "there's so much space between all of this ... the character models are small here
too ... when there's no quest, we don't need 800 feet of empty space. It can just say QUESTS in bold, and then next to it 'No quests this
game' ... I need a magnifying glass to read XP EARNED +0"; on the 1 v 1 end page: Play again and Home stacked; "do you think this chat
box makes any sense?"; "the chat box on the end game screen should not now suddenly be to the left of the board when it's to the right
during the game".

## The cause, and its fix
End screens were built and looked at one mode and one size at a time, so the gaps and duplicates only showed on Eric's devices.
`npm run stills:end-screens` (scripts/screen-stills/) plays every case for real (Boss alone won, lost, resigned; the 50 v 50 resigned; Squads
resigned; a 1 v 1 placement game lost and won, with XP, a draw) at phone 390 × 844 (the screen and the whole page), laptop 1536 × 730 and
desktop 1920 × 960 (the 1 v 1 also at 375 × 667 and Eric's 1735 × 1035), into one labeled sheet. Run it, and look at the whole sheet,
before shipping any change to an end screen.

## One spacing rule (Eric, Nov 25: "Make things spaced evenly and tight, and then we can always just center the whole thing")
- One gap between every container of an end screen (`--es-gap`, 12 px; scaled with the window in the 1 v 1's column), half of it inside
  a group (the headline and its line, a number and its label). No fixed boxes holding blank lines (XP EARNED's box is its content; the
  parts line only when it has something to say), nothing set to grow or spread; a stack shorter than the screen centered as one block.
- Every end screen's buttons stacked, the column's width, Play again on top.
- Guard: `endGaps` (e2e/helpers.ts): the gaps between consecutive containers, each the stack's one gap to 2 px, nothing growing or spread:
  the 1 v 1's end page (phone 390 × 844 in "resigning, then a flag"; laptop 1536 × 730, 1280 × 600, 1366 × 650, desktop 1920 × 960 in
  "real screens") and a boss battle resigned (phone 390 × 844, laptop 1536 × 730, boss-result.spec.ts, which also checks the short stack is
  centered).
- The "+0" Eric saw under XP EARNED was a bug: a tap before the game's XP came skipped the sequence, which wrote "+0" in the number's
  place, and the "No XP: …" line that came next reused that element and kept the "+0" (now keyed: a new element). Guarded in the same
  boss-result test (a tap on the first frame, then the line in full).

## What changed (every end screen: `EndRewards`, `end-screen.css`)
- Quests: their rows only, as many as there are; none (or still asking) is one line, "QUESTS  No quests this game." No empty rows kept.
- "XP EARNED" and its number a size bigger (12 px label, 42 px number; RP the same).
- RP: the slot over the card only when the rank counts RP. A placement game or a top tier has its card alone, which reads "Placement
  games · 1 of 5 placement games" (was "PLACEMENT / Placement 1/5" over a card saying the same).
- A boss battle's duo: the boss at 2.25 (was 2; his attack too) and your pawn at 1.8 (was 1.6); his box from his head to his feet (his frame's empty top left out), 56 px over him for his words (was 100).

## Ranked 1 v 1's end page
- A computer: the game's own screen, its right column swapped. The board stays where it was, the same size, now stepping through the
  moves (◀ "Move 2 of 2 · 1… e5" ▶ in your strip, in your clock's place; ← → too). The right column (the play panel's width, flush with the
  board's strips): the result, the rewards, the quests, your coins, Play again and Home stacked the column's width, then the chat to the
  foot. Sizes in design pixels (the window's height over 800), so a laptop shows the desktop's column, smaller. The column is a block
  centered on the board's height; its chat small (about four lines of messages, Eric: "I don't think we need ... a full-size chat"),
  right under Play again and Home.
- A phone: one tight column, buttons stacked, a small chat (240 px: about four lines of messages, its lines in one row), the move by move
  after it with room under it for Safari's bar.
- The chat's quick lines after the game are post-game ones: GG, Well played, Thanks!, Rematch? (`QUICK_CHAT.postGameLines`), then your
  emoji.

## Calls made
- The quests' box is decided when their answer comes (one line while asking, then rows if the game moved some): Eric's "no empty space"
  over keeping a box the size of rows that may never come. It's the last thing in the stack before the buttons, so only they can move,
  once, early, before the sequence reaches the quests.
- The right column runs from the top strip's top to the bottom strip's foot; its content is centered in it as one block. On a short laptop
  (1280 × 600) the chat is shorter; the page never scrolls.
- "Good game!" isn't one of the chat's lines (a new line is a chat-data change); "Well played" stands in.

## Round 2c (the director's review of the sheet, Nov 25)
- Squads' resigned page is an end screen: the headline in the pixel type, its line, the flag, Queue again over Home stacked, one gap,
  centered (it was "You resigned" pinned to the top, the buttons side by side). Its results' buttons are stacked too.
- No blank headline line: a screen whose headline has no line (you resigned, out in the crowd) never gets one later, so none is kept
  (it made the gap under "You resigned" three times the others). The 50 v 50's stage table is the column's width (340 px); no judged move
  is one line, "No moves judged this game."; the best and worst moves only with a move (their empty box took a second gap).
- A boss result on a computer with no move of yours to review is one column, centered in the page (the mate test and an instant resign);
  a game with moves keeps the move by move beside it.
- Call (reverted by the director, Nov 25): his words sat beside his head on a phone, which broke the Nov 9 design its checks guard
  (boss-result.spec.ts: his words start over him, the tail over his middle, above him). A phone keeps the computer's placement, over his
  head with room kept for two lines; that room is empty only before he speaks.
- Guard: `endPage` (resign.spec.ts: `endGaps`, buttons stacked, centered) on the 50 v 50 and Squads end pages, phone 390 x 844 and laptop
  1536 x 730; boss-result's resigned check at desktop 1920 x 960 too (the column centered with nothing to review; his words clear of your pawn).

**Round 2d (Nov 25):** a boss's frame keeps 4 to 8 rows under his feet, which hang under his end-screen box. The row now keeps room under it for whatever the 12 px gap doesn't cover (`--rd-below`, ResultDuo). That's 1.5 to 6 px for 11 bosses, nothing for the rest. The call: room under the row, so his feet stay on the pawn's base line. Cropping his canvas could cut a defeat or a jump that draws there.
