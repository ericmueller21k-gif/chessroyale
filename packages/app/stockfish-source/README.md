# Stockfish's source, served with the app

The app runs Stockfish in the browser as a separate program: `/engine/stockfish-19-lite-single.js` and `.wasm`,
copied unchanged from the npm package `stockfish` (Stockfish.js, by Nathan Rugg and Chess.com) by `vite.config.ts`.
Stockfish is GPL-3.0, so the site serves that build's complete source next to it, from here:
**`/engine/stockfish-source.tar.gz`** (linked from Settings' credits, the FAQ and `/licenses/third-party.txt`). The
build copies the archive named for the installed package's version, and fails if there isn't one: updating the
`stockfish` package means making its archive first (below). DECISIONS.md, "The Maia box's source on the site", has
the reasoning.

## `stockfish.js-19.0.0-source.tar.gz`

1,603,667 bytes, sha256 `8e6117f08877c0034edce4422cb5730ff8e3823894fb496d773e4cdb39880dd8`. Everything under
`stockfish.js-19.0.0/`:

- **Stockfish.js at its tag `v19.0.0`**, commit `9cb3e5066d48f1a35d792afeda36eff37ae60570`
  (https://github.com/nmrugg/stockfish.js), as `git archive` writes it (the commit id is in the archive's header).
  The npm package's `stockfish-19-lite-single.js` and `.wasm` are byte for byte the files of that tag's GitHub release
  (`v19.0.0`; sha256 `d3344124…e889e6` and `57ac2d72…bb5387`, checked Oct 14, 2026).
- **`src/nn-61e7af4bb97d.nnue`**, the "lite" network the build embeds (`EvalFileLiteName` in `src/evaluate.h`), which
  the build's `scripts/net.sh` would otherwise download: from https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue,
  1,166,381 bytes, sha256 `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b` (the name is its
  first 12 digits). All but one of 1,140 probes of it were found inside the shipped `.wasm`.
- **`SOURCE-FOR-HUNCHESS.txt`**: what the archive is and how to build the two files (emscripten 3.1.7,
  `node build.js --lite --single-threaded --no-split`).

How it was made (Oct 14, 2026):

```sh
git clone --depth 1 --branch v19.0.0 https://github.com/nmrugg/stockfish.js sf
git -C sf archive --format=tar --prefix=stockfish.js-19.0.0/ 9cb3e5066d48f1a35d792afeda36eff37ae60570 > sf.tar
curl -sSL -o nn-61e7af4bb97d.nnue https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue
# Python's tarfile appends SOURCE-FOR-HUNCHESS.txt and src/nn-61e7af4bb97d.nnue to sf.tar, with the commit's
# time (1789499007) and the other entries' owner (0/0, root), so the archive holds nothing that varies by machine.
gzip -n -9 -c sf.tar > stockfish.js-19.0.0-source.tar.gz
```

`packages/app/test/engine-source.test.ts` checks the archive against the installed package: its version, Stockfish's
license, the network the build names and its hash, and the note.
