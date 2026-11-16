# The Hidden Boss's fight: everything around the board stays put (Nov 14)

Eric (playtest, computer and phone): "the boards should only be replacing the one board. Everything else should look the same...
your pawns aren't here anymore... the chat's gone"; "why is the space between the boards on the left and right not the same as in
the center?"; the God King "will still be with you, but you can't use him anymore".

- The phase change and phase 2 now draw phase 1's frame (title line or the computer's boss bar and tools, Moves panel, chat, a phone's
  panel, your pawn and your team's, the God King). Only the board's square changes.
- Calls made: the four boards sit inside the one board's square on a phone too (the three small boards in a row at its top, yours
  65% under them), so nothing else on a phone moves. A computer's gaps are equal (4.3% of the square) with each tag in the gap above
  its board; each board's squares are centered in its slot (they snap to whole pixels). The God King in phase 2: greyed (grayscale,
  half opacity), button disabled, silent. The hidden eval-bar slot is gone (the bar is off for everyone since Nov 1), so the square
  is phase 1's board's exactly.
- A party's battle on a computer (the director, Nov 14; the room fight is one): the column right of the board is the Moves panel
  flush with the board's top, the chat under it at the same width, then the God King in his place on the board's bottom line
  with the team in a 2 x 2 right of him (you at its bottom left); the chat ends above them. Before, the team stood stacked above
  him and the chat overlapped them (boss-party.spec.ts:159 at 1920).
- Left for later: from phase 1's end the match places everyone, so the scoreboard reads "out" for all and a phone's Players tab is
  empty in phase 2 (a logic change in the match's standings, not layout). The phase change still absorbs the God King (another job).
