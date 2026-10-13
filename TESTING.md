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
- You keep one color per stage. When you land on a board, the last few moves you missed replay before you move.
- Your time bank is under the countdown: 10 minutes, +5 s a move, 30 s at most per move. Time never costs points.
- The **Elo** column is an engine-based rating estimate from your moves (it settles after a few rounds). Tell me if
  it feels way off for you or your friends; it's easy to recalibrate.

Quick tests: add `?rounds=2&clock=15` to the link (before creating a lobby, or for solo) for a much shorter match.

Anything odd, a screenshot plus a sentence is all I need.

## Squads stress test: the start link and Cheat lines (Oct 12, about 30 minutes)

Signed in with your admin account (players never see any of this):

1. Open **hunchess.com/squads/test** (or `/squads/test/start`). You're seated at once, every other seat a bot, and the
   first vote (**How do the boards start?**) is up straight away; then the clock vote. Vote, or tap **Skip votes**.
   From there it's a whole tournament: Relay, Pairs, then the final's Pick and Block (and Armageddon if the final is
   drawn). **Next round** (top right) ends the current round whenever you like. Add `?clock=90,0,3,0` for a quick
   team clock (bank, top-up, free seconds, increment, in seconds).
2. **Cheat lines**: a dashed button above your move panel, whenever you're choosing (your Relay move, your Pairs pick,
   your pick or block in the final, Armageddon's colors). Tap it: the engine's top 3 moves show as arrows (green
   best, then blue, then yellow), each with its evaluation for the side to move ("+0.8"; "#3" is mate in 3), and
   listed under the button as "1 · Nf3 +0.8". When you're **blocking**, they're the picking side's best moves, i.e.
   the ones worth blocking. It stays on (every new position is worked out again) until you tap it off. Your phone's
   engine does it; nothing is sent anywhere, and the bots and scoring don't know.
3. The Party sheet's **TEST LOBBY** row has **Start** too (the same as the link).
4. Tell me what breaks, especially blocks: what you blocked, what the reveal showed, and whether it felt right.

## Maia: every boss human-like (Oct 12, about 15 minutes)

Signed in with your admin account, on your phone (players still meet Stockfish; only admins meet Maia for now):

1. Tap **Boss alone**. Under the difficulty there's **BRAIN · TEST**. Leave it on **Default (Maia, no guard)**: every
   boss now plays with Maia, set to be clearly favored (your call, Oct 12: a boss is a challenge), then the bridge
   (light guard, strict guard, a growing share of Stockfish moves), then Stockfish from 2800. Or pick Stockfish / Maia with no, light, full or strict guard to compare. Pick any boss.
2. The first time, Maia downloads (about 29 MB, kept afterwards) while the boss's intro plays. Under the God King's
   dock a small line shows what the brain did with each move: "🧠 Maia 1640 · no guard · Maia's #1 · 210 ms".
   "Stockfish (Maia loading)" means Maia wasn't ready yet and Stockfish moved instead.
3. Try a **Solo raid** too (the same line shows), and, if you like, a private raid online with only you in it (your
   phone plays the boss's moves with Maia; a raid with anyone else in it stays Stockfish until it's on for players).
4. Tell me: do the bosses feel like people? Too easy, too hard, at your usual difficulty? And the ms on the line
   (under about 500 ms is fine).

## Piece sounds (Oct 11, about 3 minutes)

On your phone, with the ringer switch on:

1. **Settings → Sound.** Under **Move sound** and **Capture sound**, tap ▶ beside each option: every one should play
   at once, about as loud as the others, none harsh or clipped through the phone's speaker.
2. Pick one of each (picking plays it too), then play a few moves in **Boss alone**: your picks should sound for
   every move and capture. Tell me which ones you like, and any to drop or replace.
