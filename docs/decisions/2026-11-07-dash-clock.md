# Dash's clock: multi-hits and a pop-off (Nov 7, Eric)

Eric: "every four or five turns, he bangs on it… he hits it like five times", and once a game "I gotta pop off for a second, bro", then 10 smacks really fast, then he says again how much he loves the clock. "Every five moves he does multi hits… and always says a line."

- **Multi-hit (replaces the Nov 6 clock fit, which was at most twice a game, 3 to 5 smacks, on turns 3 to 30):** every 4 or 5 of his own moves (from the battle's seed), 5 quick smacks, and always a line about the clock. Settings: `dashClockFit`.
- **Pop-off (new):** once a battle, on a seeded turn from 8 to 20. Before his move lands: 3 smacks and the pop-off line (2.0 s), then 10 fast smacks and a love line (2.6 s). His thinking waits for it (solo and server alike), so no crowd clock runs; it's state, not an event, so it never plays after his move. Settings: `dashPopOff`.
- **Lines:** 10 new clock lines, 3 pop-off lines and 3 love lines, all under 48 characters (the 2-row bubble).
- **Test switches:** `?power=clockfit` (a multi-hit on his second turn), `?power=popoff` (the pop-off on his second turn).
- **Not built, for later:** Dash's clock as a legendary item.
