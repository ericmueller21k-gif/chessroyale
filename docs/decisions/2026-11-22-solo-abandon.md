# Solo games left after 10 moves count as a loss (Nov 22, 2026)

Eric: "if I just refresh my browser, it doesn't show it in the match history ... otherwise no one would ever resign"; "we only store
games that people are actually playing". Step 1 of 2 (step 2: Resume / Forfeit). How it works: [accounts.md](../areas/accounts.md).

Calls: only the app's load asks for the loss, never a read mid-game, nor while another tab played the game in the last 10 minutes.
A second tab's start (a Battle Tower floor's too), or an email sign-in there, does record the first's game: one open solo game per account, by design.
Test-switch and practice games aren't marked. The loss is last place, dated at the 10th move, once per game id. A finished game's
result stays on the device from the moment it's decided until the server answers it ([review fixes](2026-11-22-solo-abandon-review-fixes.md),
[decided](2026-11-22-solo-abandon-decided.md)): never left.
