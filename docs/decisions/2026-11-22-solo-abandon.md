# Solo games left after 10 moves count as a loss (Nov 22, 2026)

Eric: "if I just refresh my browser, it doesn't show it in the match history ... otherwise no one would ever resign"; "we only store
games that people are actually playing". Step 1 of 2 (step 2: Resume / Forfeit). How it works: [accounts.md](../areas/accounts.md).

Calls: only the app's load asks for the loss, never a profile read mid-game, nor while another tab played the game in the last 10
minutes (a second tab can't cost you the first's game). Test-switch and practice games aren't marked (XP's "test game"). The loss is
last place, dated at the 10th move. Each solo result keeps its game's id, so a game is recorded once. A finished game's unsent result
goes first, and a new start waits for the last result, so a game you finished is never recorded as left.
