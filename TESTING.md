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
turns, and the best average move quality wins. A solo match is about 25 minutes (as an admin, add
`?rounds=1&pace=quick` for a very fast run-through that still reaches the final).

**Also new in recent versions** (worth a look while you play):
- Switch on **Practice mode** in Settings → Testing (admins) if you want unlimited power-ups (the engine's top 3 moves with arrows).
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

## Maia: every boss human-like (Oct 12; the loading step, Oct 14; about 15 minutes)

On your iPhone (Safari), signed in with your admin account; on Wi-Fi first, then once on cellular if you can. These
checks can't be made here (no Safari, no iPhone in the test lab): the tests run Chromium, where Maia always loads.

1. Tap **Boss alone** and pick any boss (BRAIN · TEST on **Default**). Before the intro, the board goes dark under a
   card: **"Loading the boss…"** with a bar. The first time on a device (or after clearing the site's data) the bar
   fills ("12 of 40 MB") with **"First time only: about 40 MB, then it's saved on this device."** under it, then
   **"Starting…"**. From then on only "Starting…", for a second or two. Then the intro as before. **Leave** on the
   card goes home.
2. Under the God King's dock, the admins' line (it now wraps, so a long reason shows whole). At the intro it should
   read **"🧠 Maia 2500 · no guard · ready"** (your number may differ). If it says anything else, send me all of it:
   - "failed: Stockfish (load failed: …)": Maia couldn't load; the boss plays Stockfish.
   - "ready (2nd try; the 1st: …)": the first try failed and the second worked.
   - "loading (waited 20 s)": it wasn't ready in 20 s, so the battle began anyway (Maia takes over once ready).
   - "Stockfish (Maia closed: Stockfish didn't start again beside it)": the phone was short of memory for both.
3. Roughly how long the card stayed, the first time and later.
4. Play a few moves: the line shows "Maia's #1 · 210 ms" for Maia's moves (under about 500 ms is fine).
5. A **Solo raid** and a Solo **Crowd** match that ends in a boss battle: the same card before the boss arrives.
6. Online (a raid you host): no card (nobody waits for one device). Your phone loads Maia while the intro plays and
   Stockfish moves until it's ready, as before; the line says "loading", then "ready" or why it failed.

What changed for the failure you saw ("load failed: no available ba…"): Maia's WebAssembly memory limit went from 4 GB
to 512 MB (iOS Safari may refuse to set aside 4 GB), this device's Stockfish now stops while Maia loads and starts
again after, and a load that fails short of memory is tried once more. Your line tells which helped.

## Piece sounds (Oct 11, about 3 minutes)

On your phone, with the ringer switch on:

1. **Settings → Sound.** Under **Move sound** and **Capture sound**, tap ▶ beside each option: every one should play
   at once, about as loud as the others, none harsh or clipped through the phone's speaker.
2. Pick one of each (picking plays it too), then play a few moves in **Boss alone**: your picks should sound for
   every move and capture. Tell me which ones you like, and any to drop or replace.
