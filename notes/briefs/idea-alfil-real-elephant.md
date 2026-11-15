# PARKED idea: Alfil's elephant as a real piece (Eric, Nov 15)

**Status: shelved by Eric, Nov 15:** "Let's shelve this for now and add it to the notes. We may go with that later. If we do, I
think the fairy stockfish is definitely sounds like that's the way, no question. But I think there's bigger things to tackle."
Start only on Eric's word.

## The idea
Today Alfil's fused elephant is a bishop in every way, with elephant art (`elephants` squares; docs/areas/bosses.md). Eric wants
it to be a real old-style piece: **one square in any direction** (a king's step, not royal; a "commoner" / "mann"). Still open
for Eric: that, or the historical shatranj alfil (leaps exactly two squares diagonally, over anything).

## Engine: Fairy-Stockfish (Eric's pick, "no question")
- Why not swap engines only for the elephant's moves: while an elephant is on the board, every position contains it, so every
  engine job needs an engine that knows it: the boss's move (Maia now), the judge scoring the crowd's picks (Stockfish 250k
  nodes, top-8 lines), the eval bar, the results' best/worst, the Last Stand board, fair-play signals. Before the fusion and
  after the elephant is taken, nothing changes.
- Fairy-Stockfish: a Stockfish fork for invented pieces (defined in a `variants.ini`, loaded at run time; Betza notation, `K`
  for a commoner). GPL-3 like the Stockfish we ship. Browser build: `ffish-es6` on npm (WASM). Used by pychess.org.
  https://fairy-stockfish.github.io/custom-variants, https://github.com/ianfab/Fairy-Stockfish
- First step (a short spike): confirm the WASM build takes a custom variants.ini in the browser (the ffish README loads it
  from Node's fs), its multi-PV and node limits for the judge, its determinism across devices (the judge's checks compare
  devices: reports/judge-determinism.md), and a strength limit for the boss's difficulty ladder (Maia's 700 to 2500 can't
  see the piece). Note: an NNUE net is per variant; a custom variant likely falls back to its hand-made eval.
- Not chosen: our HunChess engine (packages/chess/src/hunchess/; about 2285 Elo at 30k nodes, measured Oct 21): far weaker
  than the judge's Stockfish, no multi-PV yet, and would need its own difficulty ladder.

## The bigger work, outside the engine
- Rules: the boss match runs on chess.js (packages/chess/src/rules.ts), which can't hold the piece: legal moves, check and
  pins with it, FEN/SAN (a letter for it), the board's tap targets, the server's move checks, the protocol.
- `stockfishRefuses` / position guards; history views that draw past positions.
- Balance: a commoner is worth about a bishop (~3 pawns), so two pawns for one stays fair (weaker early, stronger late);
  re-run Alfil's sim (reports/alfil-sim.md).
- Lane: **full** (judge, fair play, protocol core, rules). One xhigh Opus helper at a time; a few sessions, not an hour.
