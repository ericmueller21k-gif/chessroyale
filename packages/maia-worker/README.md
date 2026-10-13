# The Maia box

Maia-3, the human-like chess model by the Computational Social Science Lab (CSSLab) at the University of Toronto, as
a **separate program**: a Web Worker that speaks a UCI-style text protocol. HunChess bosses can ask it for the moves a
human of a given rating would play.

**License: GNU AGPL 3.0** (`LICENSE`), as Maia-3's code and weights are. Everything in this folder is part of the box
and under that license. The game (the rest of this repository) never imports, bundles or shares memory with any of it:
it starts the built worker (`/engine/maia/maia-worker.js`) and exchanges plain-text lines with it, exactly as it does
with Stockfish. Nothing in this folder imports game code.

## What's here

| Path | What |
| --- | --- |
| `LICENSE` | The GNU AGPL 3.0, as shipped by CSSLab/maia3 |
| `scripts/convert.py`, `scripts/requirements.txt` | The conversion: the official checkpoint to ONNX, then int8, with checks |
| `model/maia3-23m-int8.onnx` | The converted model (committed; 25,191,199 bytes, 24.02 MiB) |
| `src/encode.ts` | The model's input (64 squares × 12 planes, × 8 boards of history) and its 4352 moves |
| `src/policy.ts` | Probabilities over the legal moves, and the official way of drawing one (temperature, top-p) |
| `src/model.ts` | The model in onnxruntime-web's WebAssembly backend, one thread |
| `src/uci.ts` | The text protocol (below) |
| `src/worker.ts` | The Web Worker |
| `src/cli.ts` | The same engine on stdin/stdout for Node (simulations): `npx tsx packages/maia-worker/src/cli.ts` |
| `scripts/build.mjs` | Builds `dist/`: `maia-worker.js`, `ort-wasm-simd-threaded.wasm`, the model, `LICENSE.txt`, `NOTICE.txt` |
| `licenses/` | License texts of what the build bundles (onnxruntime-web's MIT; chess.js's BSD comes from its package) |
| `test/` | The encoder against the official tokenizer, the protocol, and the model in the browser runtime |

## Where the model comes from (provenance)

- **Checkpoint:** the official `maia3-23m.pt` from Hugging Face `UofTCSSLab/Maia3-23M`, revision
  `51a0145a8178046f7de23119160b136672deeb2b`, 91,799,307 bytes, sha256
  `bce6cd1af5f0399ac7eed33fabb7a6a2ef6193662c2740f262bf93af7bfb3569` (22,936,580 parameters).
- **Model code:** the official repository `https://github.com/CSSLab/maia3` at commit
  `1e13597c42d4858b7cfd7cfdae01e297263364b2` (`maia3/models.py` `MAIA3Model`, the `maia3-23m` preset in
  `maia3/model_registry.py`). The conversion clones it; none of it is copied here.
- **No third-party export** is used: the conversion below starts from the official checkpoint.

## The conversion, step by step (`scripts/convert.py`)

Run with Python 3.11 and `scripts/requirements.txt` (torch 2.14.1 CPU, onnx 1.23.2, onnxruntime 1.23.2, numpy, chess):

```sh
python -I packages/maia-worker/scripts/convert.py --work <scratch dir>     # about 30 s on a CPU
```

1. Clone `CSSLab/maia3` at the commit above; download the checkpoint at the revision above and check its sha256.
2. Build `MAIA3Model` with the official 23M preset (history 8, dim 512, 16 heads, 8 blocks, GAB on, RMSNorm) and load
   the checkpoint, renaming any old `smolgen` keys to `gab` as the official loader does. No missing keys allowed.
3. Replace each `nn.RMSNorm` with the same sum written out (`x · rsqrt(mean(x²) + eps) · weight`, eps the float32
   epsilon as `RMSNorm(eps=None)` uses), because the exporter has no rule for it at opset 17. Checked: the outputs
   don't change (under 1e-4).
4. Export with PyTorch's TorchScript exporter (`dynamo=False`), opset 17, constant folding, a dynamic batch:
   - inputs `tokens` [B, 64, 96] float32 (8 boards × 12 planes per square; we repeat the current board, as the
     official engine does by default), `elo_self` [B] and `elo_oppo` [B] float32;
   - outputs `logits_move` [B, 4352] and `logits_value` [B, 3] (loss, draw, win for the side to move). The ponder
     head is dropped.
5. Quantize with `onnxruntime.quantization.quantize_dynamic(fp32, int8, weight_type=QInt8, per_channel=False,
   reduce_range=False)`: int8 weights, per tensor; activations quantized on the fly.
6. Check and write the fixtures:
   - fp32 ONNX against PyTorch, 18 positions × 6 ratings: largest logit difference 4.96e-05;
   - int8 against PyTorch, top move over the legal moves: 106 of 108 the same, 108 of 108 within int8's top 3 (the
     two that differ are near-ties); largest top-3 probability difference 0.059;
   - `test/fixtures/encoding.json`: the official tokenizer's planes and move indices for those positions (both sides
     to move, castling, en passant, promotions and under-promotions both ways);
   - `test/fixtures/maia3-23m-int8-top.json`: the int8 file's top 5 moves (native onnxruntime) and PyTorch's.

Result: `model/maia3-23m-int8.onnx`, 25,191,199 bytes (24.02 MiB), sha256
`441dee8ddb0022e59554dc83c866306ff9b896b17c7ce7fd1cc65d475bead253`. The fp32 file (91 MB) and the checkpoint stay in
the scratch directory and are not kept.

The 5M model converts the same way (`--model 5m`; checkpoint revision `b6559de2398d7140b985f28fd2c19fb5e47ddabe`,
sha256 `ba14208b…62524f`), for the non-boss bots later.

## Speed and size

- In onnxruntime-web 1.30.0's WebAssembly, one thread: about **75–85 ms a move** on this machine's CPU (Node and
  headless Chromium alike; the first move about 200 ms), so roughly 0.2–0.35 s on a phone. Loading: about 1–2.5 s.
- Memory with the model loaded: about 350–450 MB. The game ends the worker after each battle.
- Download, as served live (measured Oct 11): the model 25.2 MB as it is (Cloudflare doesn't compress `.onnx`; it
  would only shrink about 20% anyway), onnxruntime's WebAssembly 3.3 MB (brotli; 14.2 MB unpacked), the worker 40 KB
  (brotli): about 28.5 MB the first time. Fetched only for a battle that uses Maia, then kept by the service worker.

## The protocol (`src/uci.ts`)

One command per message in, one line per message out:

```
uci                                   → id name …, id author …, option …, uciok
isready                               → loads the model (first time), then readyok
                                        (a failed load: "info string error load failed: …" before readyok)
ucinewgame                            → the starting position
setoption name UCI_Elo value N        → the rating Maia plays as (and its opponent's, unless OppoElo is set)
setoption name OppoElo value N        → the opponent's rating
setoption name Temperature value T    → how bestmove is drawn: 0 = the likeliest move (default)
setoption name TopP value P           → keep only the likeliest moves whose total stays within P (1 = all)
setoption name MultiPV value K        → candidates listed per go (default 5)
setoption name Seed value S           → a fixed seed for the draws (0 = random)
position startpos|fen <fen> [moves …]
go [searchmoves m1 m2 …]              → info depth 1 multipv k time <ms> p <probability> pv <move>   (top K)
                                        bestmove <move>   (or bestmove (none): no legal move)
quit                                  → frees the model and ends the worker
```

`p` comes before `pv` because UCI ends an info line with its pv; UCI tools ignore the extra token.

## Building and testing

- `npm run build -w maia-worker` writes `dist/`; the app's build copies `dist/` into `public/engine/maia/` as it is
  (the root `npm run build` does both).
- `npx vitest run packages/maia-worker` runs the box's tests (the model test loads the real file: about 6 s).

## Source availability

This folder is the box's complete source. Publishing it (for example as a public repository, or a download on the
site) is a launch step that needs Eric's OK; until then the site is private and the in-game notice says the source is
available on request.
