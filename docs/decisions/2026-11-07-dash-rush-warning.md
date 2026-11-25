# Dash's Scramble Rush: a warning a turn ahead, two moves a piece (Nov 7, 2026)

Eric (Nov 6, playtesting): "it fired off way too fast … there's no warning … treat it as another ult … next turn he does [Scramble Rush] … hope you were watching." And: "I can just spam … make a hard rule where you can only move a piece up to 2 times … shake the piece and … put a little fading text that just says no more tries."

- **The warning is every ultimate's:** event `rushWarn` as a crowd turn begins (after his move), the shared RAGE! view (`rageWarn`), "Next turn: Scramble Rush", his warning cast and a line (`DASH_RUSH_LINES.warn`), the warning's length (1700 ms and its banner). The call: your turn after the warning plays as ever (as after every ultimate's warning); the Rush comes as the next crowd turn begins, after his next move, where it came before. Time Scramble waits while the Rush is warned.
- **The cap** (`dashScramble.movesPerPiece`: 2) counts by the piece (its square before the sweep), wherever it stands. One shared check, `rushKeep`, on every screen and on the server, so a client can't spam past it.
- **No submit button:** the put-back has none (Eric's Nov 6 design: time's up judges). A piece out of moves locks nothing: the others still go back and count.
