# Decisions

Judgement calls made while building, with the reason for each. Eric asked to be involved as little as possible, so
these weren't reviewed first. Most are a single line in `packages/core/src/settings.ts`.

## Milestone 1: match engine and scoring

- **Engine build: Stockfish 19 "lite single-threaded" WebAssembly** (npm `stockfish`, 1.8 MB). It's the small-network
  build the spec asks for, needs no cross-origin isolation headers, and the same file runs in Node (child process)
  and the browser (Web Worker). It speaks plain UCI over text. At 100,000 nodes a search takes about 0.15–0.25 s in
  Node here, and repeated searches give identical numbers. (Raised to 250,000 in milestone 2.)
- **One search scores a whole group.** A MultiPV search returns the top N moves with win/draw/loss for each; any
  picked move outside them gets one extra search restricted to those moves (`searchmoves`). Bots use the same top-8
  search. Every search starts with `ucinewgame`, which clears the hash.
- **Expected score** = (win + draw / 2) / 1000 from Stockfish's WDL output, from the mover's side.
- **A board's expected score for retirement** is taken from the previous round's search (the drawn move's score,
  flipped to the new side to move), so no extra search is needed before dealing.
- **Grouping:** a local search that swaps players between groups, treating "same board as last round" as a hard
  constraint (while 4+ boards) and repeat groupmates as a soft cost. In tests it reaches zero repeats.
- **Openings: Lichess chess-openings (CC0).** For each named variation, take its longest line. Short lines are
  extended with the engine's best moves to 21 plies, and each is scored at 20 and 21 plies, so any board can start
  with either side to move (a replacement board must match the others). A line is kept if either ending is inside
  0.40–0.60. "Unusual" means irregular openings: the Lichess A00/B00 families plus a short list of offbeat
  gambits (`UNUSUAL_FAMILIES` in the build script).
- **Each match picks 7 classic + 1 unusual opening from different families.**
- **Chess rules: chess.js** (BSD-2). The board UI component is chosen in milestone 3.

## Milestone 2: simulation and playtest report

The report is `reports/playtest.md` (200 full bot matches at 100,000 nodes, plus 1,000 replayed matches per variant).
Answer to its question 8, the settings changed or kept because of it:

- **Engine budget: 100,000 → 250,000 nodes.** The report found the 100k search names the same group winner as a
  search 20 times larger only 87% of the time (90th-percentile loss error 15 points). A follow-up on 60 more
  positions measured 86.6% at 100k, **91.1% at 250k** and 94.0% at 500k, at 0.25, 0.59 and 1.08 s per search in
  Node. 250k cuts the wrong-winner rate by a third. To keep the extra cost from adding a wait, each round's top-move
  searches now **start as soon as the round is dealt**, while players think (solo; in multiplayer the server sends
  the host every board at round start). After the picks lock, only a pick outside the top 8 needs a search. 500k
  would risk running past the 10-second clock on a phone in solo. If Eric's iPhone test shows slow scoring, this is
  the setting to lower.
- **Scores between stages: keep reset.** Carry-over halves how often the strongest bot reaches the duel (15% vs 33%
  at 8 rounds) without improving the overall skill order, because one bad early stage can't be recovered from.
- **Rounds per stage: keep 8.** Going to 10 or 12 barely changes the rank correlation (0.667 → 0.670 → 0.675) and
  adds 3–5 minutes. 6 rounds is about as fair and 2 minutes shorter, so it's the first thing to try if real matches
  feel long.
- **Dead rounds (43%): no change yet.** Bots almost always pick among the engine's top moves, so nearly half of
  groups tie. People with 10 seconds on an unfamiliar position will spread out much more. If real players also tie
  often, the lever is fewer quiet positions (a tighter opening balance window, or retiring boards earlier than 0.90).
- **Retirement: keep 0.90.** About 4.7 boards a match are retired, almost all for reaching 0.90, which is the
  intended way out of decided positions.
- **Placement tracks skill (rank correlation 0.67), with plenty of upsets:** a top-4 bot goes out in stage 1 about a
  quarter of the time, and the strongest bot wins about 1 match in 5. That fits a party game, so no change.
- **Bot skills:** the spread used in the report (T from 0.25 to 32, log scale) is now the `botSkillRange` setting,
  and the same spread fills empty seats in solo and in lobbies.

## Milestone 3: solo build

- **Board component: chessground** (Lichess's board, GPL-3). Tap-tap and drag, legal-square dots, last-move highlight
  and arrows for the reveal all come built in. GPL matches Stockfish's licence, so the app as a whole is GPL anyway.
- **Engines in the browser: up to 4 Web Workers** (cores − 1). The 8 boards of a round are scored in parallel, so
  scoring takes well under a second on a laptop. The results screen prints the time per round on that device.
- **Pacing.** The opening grid plays for 6 s; the reveal shows for 4 s plus 1.5 s for the drawn move, and a tap skips
  it; solo stage breaks wait for a tap. All are in `settings.ts`.
- **When you're knocked out in solo,** the rest of the match is simulated quickly (there's nobody to watch) and the
  results show where you finished. A duel between two bots is decided by lower average loss over a sample of
  positions, rather than playing a 6-minute bot game.
- **Solo duel vs a bot:** the bot thinks for a short random time (less when its clock is low), so it can lose on time
  only if you play very fast. A draw goes to the lower average loss, as the spec says.
- **Playtest overrides in the URL:** `?rounds=2&clock=15&duel=60` change those settings for that match only (also when
  creating a lobby). Handy for a quick test; normal links play the real settings.

## Milestone 4: multiplayer lobbies

- **One Durable Object per lobby, with a 5-letter code** (no 0/O/1/I/L). Invite links are `/lobby/CODE`.
- **Seats survive reloads.** Joining stores a seat token on the device; reopening the link (or reloading) rejoins the
  same seat and the server resends the current screen.
- **Host scoring.** After picks lock, the host's browser gets one job per board, scores it, and picks for the bots.
  If the host leaves, the first connected player on a computer (else any player) becomes host and gets the job. If
  nobody answers within 15 s, every pick on that round counts as equal (all score 0) rather than stalling the match.
- **Cross-check.** Every other player's browser re-scores its own group after the reveal and reports mismatches,
  which the server logs. The checker runs exactly the same searches as the host, in the same order, with the
  `searchmoves` list sorted, so honest devices agree exactly. An early version used a slightly different sequence
  and logged 2 mismatches in a test match; with identical searches the next full match logged none.
- **Rounds lock early** once every live human has picked, so nobody waits out the clock for bots.
- **Duel in multiplayer:** the server runs both clocks. If a finalist is a bot, the host's browser chooses its moves.
  The higher final-four scorer has 15 s to choose a colour, then gets White.

## Milestone 5: spectating and polish

- **Evaluation bar** for duel spectators, computed by the spectator's own browser from the position on screen. The
  server never sends evaluations, so the players can't see it even by inspecting traffic.
- **Install:** web manifest, icons (gold crown over a pawn), and a service worker that precaches the app and the
  1.8 MB engine, so solo works offline and the app opens instantly. Pages are always fetched fresh when online (the
  Word Trap lesson), so updates show up on the next open. Android/desktop Chrome get an Install button; iPhone gets
  Share → Add to Home Screen instructions.
