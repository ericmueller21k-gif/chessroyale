#!/usr/bin/env python3
# Maia box: converts an OFFICIAL Maia-3 checkpoint (CSSLab, University of Toronto) to ONNX, quantises it to int8 and
# checks both against the official PyTorch model. Part of the Maia box (packages/maia-worker), AGPL-3.0: see LICENSE.
#
# Usage (any directory; Python 3.11 with the packages in requirements.txt):
#   python -I packages/maia-worker/scripts/convert.py --work <scratch dir> [--model 23m]
#
# What it does (every source pinned below; README.md has the story):
#   1. Clones CSSLab/maia3 at MAIA3_COMMIT into <work>/maia3, for its model code (maia3/models.py) and its presets.
#   2. Downloads the checkpoint from Hugging Face at a pinned revision into <work>/ and checks its sha256.
#   3. Builds MAIA3Model with the official preset for that size and loads the checkpoint (no missing keys allowed).
#   4. Exports it to ONNX (TorchScript exporter, opset 17), fp32, into <work>/:
#        inputs   tokens [B, 64, 96] float32 (8 boards of 12 planes: the official history input; we repeat the
#                 current board 8 times, as the official engine does by default), elo_self [B], elo_oppo [B] float32
#        outputs  logits_move [B, 4352] (4096 from-to + 256 promotions), logits_value [B, 3] (loss, draw, win)
#   5. Quantises it with onnxruntime's dynamic quantisation (int8 weights, per tensor) into model/<name>-int8.onnx.
#   6. Checks the fp32 and int8 files against PyTorch on fixed positions and writes the test fixtures
#      (test/fixtures/*.json): the official tokenizer's encodings and move indices, and the int8 file's top moves.
import argparse
import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from types import SimpleNamespace

MAIA3_REPO = "https://github.com/CSSLab/maia3"
MAIA3_COMMIT = "1e13597c42d4858b7cfd7cfdae01e297263364b2"

CHECKPOINTS = {
    "23m": {
        "preset": "maia3-23m",
        "hf_repo": "UofTCSSLab/Maia3-23M",
        "revision": "51a0145a8178046f7de23119160b136672deeb2b",
        "file": "maia3-23m.pt",
        "sha256": "bce6cd1af5f0399ac7eed33fabb7a6a2ef6193662c2740f262bf93af7bfb3569",
    },
    "5m": {
        "preset": "maia3-5m",
        "hf_repo": "UofTCSSLab/Maia3-5M",
        "revision": "b6559de2398d7140b985f28fd2c19fb5e47ddabe",
        "file": "maia3-5m.pt",
        "sha256": "ba14208b2992d85502f5fb501934abf6aaaeb355e9f3fdf90e326911f562524f",
    },
}

BOX = Path(__file__).resolve().parents[1]
HISTORY = 8

# Positions for the checks and the fixtures: both sides to move, castling, en passant, promotions (both colours,
# captures and under-promotions), checks, endgames.
FENS = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 6",
    "r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 10",
    "2r2rk1/pp3ppp/2n1pn2/q2p4/3P4/P1PBPN2/5PPP/R2Q1RK1 b - - 0 14",
    "r4rk1/1bqnbppp/p2ppn2/1p6/3NP3/1BN1BP2/PPPQ2PP/2KR3R w - - 0 12",
    "rnb1kbnr/pppp1ppp/8/4p3/4P2q/8/PPPPQPPP/RNB1KBNR b KQkq - 0 1",
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
    "rnbqkbnr/pppp1ppp/8/8/3Pp3/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 3",
    "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R b KQkq - 5 8",
    "8/8/8/8/8/2k5/p7/4K3 b - - 0 1",
    "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    "4k3/8/8/8/8/8/1p6/R3K3 b - - 0 1",
    "8/5pk1/6p1/3P4/2p2P2/6P1/5K2/8 w - - 0 40",
    "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
]
ELOS = [800, 1100, 1500, 2000, 2600, 3000]


def log(*a):
    print(*a, flush=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_source(work: Path) -> Path:
    repo = work / "maia3"
    if not repo.exists():
        subprocess.run(["git", "clone", "-q", MAIA3_REPO, str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "checkout", "-q", MAIA3_COMMIT], check=True)
    head = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    assert head == MAIA3_COMMIT, head
    return repo


def fetch_checkpoint(work: Path, ck: dict) -> Path:
    path = work / ck["file"]
    if not path.exists():
        url = f"https://huggingface.co/{ck['hf_repo']}/resolve/{ck['revision']}/{ck['file']}"
        log("downloading", url)
        urllib.request.urlretrieve(url, path)
    got = sha256(path)
    if got != ck["sha256"]:
        raise SystemExit(f"{path}: sha256 {got}, expected {ck['sha256']}")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True, help="scratch directory for the clone, the checkpoint and the fp32 ONNX")
    ap.add_argument("--model", default="23m", choices=sorted(CHECKPOINTS))
    args = ap.parse_args()
    work = Path(args.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    ck = CHECKPOINTS[args.model]

    repo = fetch_source(work)
    ckpt = fetch_checkpoint(work, ck)
    sys.path.insert(0, str(repo))

    import numpy as np
    import torch
    import torch.nn as nn
    import chess
    import onnx
    import onnxruntime as ort
    from onnxruntime.quantization import QuantType, quantize_dynamic

    from maia3.dataset import tokenize_board
    from maia3.model_registry import resolve_model_spec
    from maia3.models import MAIA3Model
    from maia3.utils import get_all_possible_moves, mirror_move

    torch.manual_seed(0)
    spec = resolve_model_spec(ck["preset"])
    cfg = SimpleNamespace(**spec.config)
    assert cfg.history == HISTORY and not cfg.include_time_info
    model = MAIA3Model(cfg)
    state = torch.load(ckpt, map_location="cpu", weights_only=True)
    state = state["model_state_dict"] if isinstance(state, dict) and "model_state_dict" in state else state
    # (As the official loader: older checkpoints call the attention bias "smolgen".)
    state = {k.replace("smolgen", "gab"): v for k, v in state.items()}
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:
        raise SystemExit(f"missing keys: {missing}")
    log("loaded", ckpt.name, "params", sum(p.numel() for p in model.parameters()), "unexpected keys", unexpected)
    model.eval()

    # The exporter has no rule for nn.RMSNorm at opset 17: the same sum, written out (checked equal below).
    class RMSNormOut(nn.Module):
        def __init__(self, src: nn.RMSNorm):
            super().__init__()
            self.weight = src.weight
            self.eps = src.eps if src.eps is not None else torch.finfo(torch.float32).eps

        def forward(self, x):
            return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight

    class Export(nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, tokens, elo_self, elo_oppo):
            move, value, _ponder = self.m(tokens, elo_self, elo_oppo)
            return move, value

    all_moves = get_all_possible_moves()
    index = {m: i for i, m in enumerate(all_moves)}

    def tokens_for(fen: str) -> np.ndarray:
        board = tokenize_board(chess.Board(fen)).numpy()  # (64, 12), the official tokenizer
        return np.tile(board, (1, HISTORY))[None].astype(np.float32)  # (1, 64, 96): the current board 8 times

    def legal_indices(fen: str):
        b = chess.Board(fen)
        out = []
        for mv in b.legal_moves:
            u = mv.uci() if b.turn == chess.WHITE else mirror_move(mv.uci())
            out.append((mv.uci(), index[u]))
        return out

    def torch_logits(m, fen, elo):
        with torch.no_grad():
            t = torch.from_numpy(tokens_for(fen))
            e = torch.tensor([float(elo)])
            move, value = m(t, e, e)
        return move[0].numpy(), value[0].numpy()

    def top_legal(logits, fen, k=5):
        legal = legal_indices(fen)
        ls = np.array([logits[i] for _, i in legal], dtype=np.float64)
        p = np.exp(ls - ls.max())
        p /= p.sum()
        order = np.argsort(-p)[:k]
        return [(legal[j][0], round(float(p[j]), 6)) for j in order]

    export = Export(model).eval()
    # Swap the RMSNorms, checking the swap changes nothing.
    ref = {(f, e): torch_logits(export, f, e) for f in FENS[:4] for e in (1100, 2000)}
    for blk in model.transformer.layers:
        for name in ("norm1", "norm2"):
            n = getattr(blk, name)
            if isinstance(n, nn.RMSNorm):
                setattr(blk, name, RMSNormOut(n))
    for (f, e), (mv, val) in ref.items():
        mv2, val2 = torch_logits(export, f, e)
        assert np.abs(mv - mv2).max() < 1e-4, ("RMSNorm swap changed the output", np.abs(mv - mv2).max())

    name = spec.name
    fp32 = work / f"{name}-fp32.onnx"
    int8 = BOX / "model" / f"{name}-int8.onnx"
    t = torch.from_numpy(tokens_for(FENS[3]))
    e = torch.tensor([1500.0])
    log("exporting", fp32)
    torch.onnx.export(
        export,
        (t, e, e),
        str(fp32),
        input_names=["tokens", "elo_self", "elo_oppo"],
        output_names=["logits_move", "logits_value"],
        dynamic_axes={"tokens": {0: "batch"}, "elo_self": {0: "batch"}, "elo_oppo": {0: "batch"}, "logits_move": {0: "batch"}, "logits_value": {0: "batch"}},
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    onnx.checker.check_model(str(fp32))
    log("quantising", int8)
    int8.parent.mkdir(parents=True, exist_ok=True)
    if int8.exists():
        int8.unlink()
    quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QInt8, per_channel=False, reduce_range=False)

    def session(path):
        so = ort.SessionOptions()
        so.intra_op_num_threads = 1
        so.inter_op_num_threads = 1
        return ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])

    s32, s8 = session(fp32), session(int8)

    def onnx_logits(s, fen, elo):
        e = np.array([float(elo)], np.float32)
        move, value = s.run(["logits_move", "logits_value"], {"tokens": tokens_for(fen), "elo_self": e, "elo_oppo": e})
        return move[0], value[0]

    worst32 = 0.0
    agree1 = agree3 = n = 0
    worst_p = 0.0
    for f in FENS:
        for elo in ELOS:
            tm, _ = torch_logits(export, f, elo)
            om, _ = onnx_logits(s32, f, elo)
            qm, _ = onnx_logits(s8, f, elo)
            worst32 = max(worst32, float(np.abs(tm - om).max()))
            a, b = top_legal(tm, f), top_legal(qm, f)
            n += 1
            agree1 += a[0][0] == b[0][0]
            agree3 += a[0][0] in [m for m, _ in b[:3]]
            pa = dict(a)
            worst_p = max(worst_p, max(abs(pa.get(m, 0.0) - p) for m, p in b[:3]))
    log(f"fp32 ONNX vs PyTorch: max |logit difference| {worst32:.2e}")
    log(f"int8 vs PyTorch, top move over legal moves: {agree1}/{n} the same, {agree3}/{n} within int8's top 3; worst top-3 probability difference {worst_p:.3f}")
    assert worst32 < 1e-3, "the fp32 export doesn't match PyTorch"

    # Speed (native onnxruntime, one thread; the browser's WASM is slower).
    for label, s in (("fp32", s32), ("int8", s8)):
        for f in FENS[:3]:
            onnx_logits(s, f, 1500)
        ts = []
        for i in range(30):
            t0 = time.perf_counter()
            onnx_logits(s, FENS[i % len(FENS)], 1500)
            ts.append((time.perf_counter() - t0) * 1000)
        ts.sort()
        log(f"{label}: native ORT median {ts[len(ts) // 2]:.1f} ms")

    # Fixtures for the box's tests.
    fx = BOX / "test" / "fixtures"
    fx.mkdir(parents=True, exist_ok=True)
    encodings = []
    for f in FENS:
        board = tokenize_board(chess.Board(f)).numpy()
        hot = [[int(sq), int(ch)] for sq, ch in zip(*np.nonzero(board))]
        encodings.append({"fen": f, "hot": hot, "moves": {u: i for u, i in legal_indices(f)}})
    (fx / "encoding.json").write_text(json.dumps({"source": f"{MAIA3_REPO}@{MAIA3_COMMIT} maia3/dataset.py tokenize_board, maia3/utils.py get_all_possible_moves + mirror_move", "positions": encodings}, separators=(",", ":")) + "\n")
    preds = []
    for f in FENS:
        for elo in (1100, 2000, 3000):
            qm, qv = onnx_logits(s8, f, elo)
            tm, _ = torch_logits(export, f, elo)
            vv = np.exp(qv - qv.max())
            vv /= vv.sum()
            preds.append({"fen": f, "elo": elo, "int8": top_legal(qm, f), "pytorch": top_legal(tm, f), "wdl": [round(float(vv[2]), 6), round(float(vv[1]), 6), round(float(vv[0]), 6)]})
    (fx / f"{name}-int8-top.json").write_text(json.dumps({"model": int8.name, "note": "top 5 legal moves with probabilities: int8 = this ONNX file in native onnxruntime (CPU), pytorch = the official fp32 checkpoint", "positions": preds}, separators=(",", ":")) + "\n")
    log("fp32", fp32.stat().st_size, "bytes; int8", int8.stat().st_size, "bytes", f"({int8.stat().st_size / 2**20:.2f} MiB)", "sha256", sha256(int8))


if __name__ == "__main__":
    main()
