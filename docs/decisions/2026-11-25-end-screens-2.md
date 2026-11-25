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

## What changed (every end screen: `EndRewards`, `end-screen.css`)
- Quests: their rows only, as many as there are; none (or still asking) is one line, "QUESTS  No quests this game." No empty rows kept.
- "XP EARNED" and its number a size bigger (12 px label, 42 px number; RP the same).
- RP: the slot over the card only when the rank counts RP. A placement game or a top tier has its card alone, which reads "Placement
  games · 1 of 5 placement games" (was "PLACEMENT / Placement 1/5" over a card saying the same).
- A boss battle's duo: the boss at 2.5 (was 2; his attack too) and your pawn at 2 (was 1.6), 24 px less room over him for his words.

## Ranked 1 v 1's end page
- A computer: the game's own screen, its right column swapped. The board stays where it was, the same size, now stepping through the
  moves (◀ "Move 2 of 2 · 1… e5" ▶ in your strip, in your clock's place; ← → too). The right column (the play panel's width, flush with the
  board's strips): the result, the rewards, the quests, your coins, Play again and Home stacked the column's width, then the chat to the
  foot. Sizes in design pixels (the window's height over 800), so a laptop shows the desktop's column, smaller.
- A phone: one tight column, buttons stacked, the chat 290 px (its lines in one row, a real message area), the move by move after it with
  room under it for Safari's bar.
- The chat's quick lines after the game are post-game ones: GG, Well played, Thanks!, Rematch? (`QUICK_CHAT.postGameLines`), then your
  emoji.

## Calls made
- The quests' box is decided when their answer comes (one line while asking, then rows if the game moved some): Eric's "no empty space"
  over keeping a box the size of rows that may never come. It's the last thing in the stack before the buttons, so only they can move,
  once, early, before the sequence reaches the quests.
- The right column runs from the top strip's top to the bottom strip's foot (not the squares' top and bottom): the chat gets those
  84 px. On a short laptop (1280 × 600) the chat is shorter (about 60 px of messages); the page never scrolls.
- "Good game!" isn't one of the chat's lines (a new line is a chat-data change); "Well played" stands in.
