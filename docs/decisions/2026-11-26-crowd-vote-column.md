# The 50 v 50's opening vote: its column to the board's foot (Nov 26, 2026)

- The director's round 2 on #956: the vote's right column stopped under the cards, about 700 px short of the board's foot at 1920 × 960 (Eric's column rule).
- Now, on a computer: the line that says what to do on one line, left on the gear's line; the cards filling the game's 250 px slot (name and blurb at the top, bar and count at the foot); then the game's chat (`UnderBoard`), the same component in the same place. Chat is open from the lobby on (`lobby.ts` `chatOpen`), so it's live in the vote. A phone's vote is unchanged (no chat).
- Copy, shorter so every line fits the 280 px column (236 px beside the gear, measured ≤ 202): "Drag your pawn or tap a card.", "Vote in. Drag to change it.", "No vote: you're with the crowd." (you), "No vote? You're with the crowd." (the others). The phone says the same.
- Guard: the column rule's test now covers the vote (both sizes), its line on one line, and the board, the scoreboard and the chat in the same place at move 1.
