# Checking it on your phone (about 10 minutes)

Everything below has been tested on emulated phones (iPhone 13 and desktop Chrome). What emulation can't prove is
that a real iPhone runs the chess engine fast enough, so that's the main thing to check.

1. **Solo on your iPhone.** Open the link in Safari and tap **Play solo vs 31 bots**. Play a few rounds.
   - Do the boards appear and does a move register on the first tap?
   - After you've finished (or been knocked out), the results screen shows **"Scoring took X ms per round on this
     device"**. Anything under about 3000 ms is fine. Tell me the number.
2. **Install it.** In Safari tap Share → **Add to Home Screen**, then open it from the home screen. It should open full
   screen with the gold crown icon.
3. **A lobby with a friend.** On your computer, tap **Create a lobby** and send the invite link to a friend (or your own
   phone). When they've joined, tap **Start**. Your computer does the scoring for everyone, so keep that tab open.
   - Reload the page on the phone mid-match: it should drop you straight back into the same seat.
   - If you're knocked out, you can watch the remaining boards and, at the end, the 2v2 final.

**New: 64 players and a 2v2 final.** 8 boards with 8 players each; each cut removes the bottom 8 and the most
lopsided board, down to 4 players on the last board. Then a 2v2 final: seeds 1 & 4 against 2 & 3, teammates take
turns, and the best average move quality wins. A solo match is about 25 minutes at the relaxed pace
(`?rounds=1&pace=quick` for a very fast run-through that still reaches the final).

**Also new in recent versions** (worth a look while you play):
- Tick **Practice mode** on the first screen if you want unlimited power-ups (the engine's top 3 moves with arrows).
- The strip above the board shows your position and how far you are above or below the elimination line; tap it
  for the full leaderboard. On a computer the leaderboard sits on the left all the time.
- You keep one colour per stage. When you land on a board, the last few moves you missed replay before you move.
- Your time bank is under the countdown: 10 minutes, +5 s a move, 30 s at most per move. Time never costs points.
- The **Elo** column is an engine-based rating estimate from your moves (it settles after a few rounds). Tell me if
  it feels way off for you or your friends; it's easy to recalibrate.

Quick tests: add `?rounds=2&clock=15` to the link (before creating a lobby, or for solo) for a much shorter match.

Anything odd, a screenshot plus a sentence is all I need.
