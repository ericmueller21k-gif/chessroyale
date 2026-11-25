# Ranked 1 v 1: colors in turn, not a coin flip, Nov 25, 2026

Eric, Nov 25 (after the director's research: chess.com balances colors in matchmaking, its ratings have no color factor; Lichess's
optional White edge): "Color balance seems good, and add this to the handbook". So: balanced colors, **no White edge in the rating**.
Before: a coin flip as each pair was seated (`seatDuel`). Now core's `firstGetsWhite`, from each player's colors in their last ranked
games (read with the ticket, `recentColors`): no third game in a row on one color when the other can take it; then whoever had more
Black over the last 10; then whoever had Black last; then a coin. `RANKED_1V1.colors`. Calls made: when both are in the same bind,
the longer run switches first (a sim of 40 × 12 players × 300 games: longest run 3, not 4); no games ranks between "Black last" and
"White last"; a failed read is no history (a coin flip). Bot and town games: unchanged, and not counted.
