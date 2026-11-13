"""Builds the game-ready boss themes: each song as an intro piece (played once) and a loop piece (repeated), as OGG and
MP3 (mono, the MP3 at 64 kbps: Eric, Nov 12, "Mono 64 sounds... it's totally fine"), with a manifest. Both pieces get one fixed gain (about -16 LUFS for intro + one pass of the loop, a little under where the
peaks need the room) and master.py's soft ceiling.
  python3 handoff.py <out folder> [boss id ...]   (only those bosses; the folder's themes.json keeps the others)

How the pieces are made: the song is rendered twice. Once keeping only the notes that start before the intro's end,
so the intro's tails ring on past it (the intro file is the intro plus those tails). Once keeping only the rest, into
a buffer exactly one loop long, where every tail wraps round: that buffer repeats without a seam.
The loop file has PAD seconds of the loop's end before it and PAD of its start after it, and is looped between PAD
and PAD + loopSeconds: an encoder's added silence (MP3's) then shifts nothing that matters.
"""
import importlib
import json
import os
import subprocess
import sys
import wave

import numpy as np

import master
import synth

PAD = 0.5
TAIL = 4.0
HEADROOM = 0.86  # the pieces' summed peak before encoding: -1.3 dBFS
# Mono (Eric, Nov 12): the themes have about 2% side energy, so folding them to (L + R) / 2 loses almost nothing, halves the
# file and halves the decoded audio a phone keeps (a 2-minute theme about 46 MB stereo, 23 MB mono). The song is folded right
# after it's rendered, so the level, the ceiling and the manifest's numbers are all measured on what ships (played on both
# speakers, as Web Audio plays a mono file). MP3 at a constant 64 kbps. MONO = False gives the old stereo pieces.
MONO = True
MP3 = ["-c:a", "libmp3lame", "-b:a", "64k"] if MONO else ["-c:a", "libmp3lame", "-q:a", "5"]
# boss id (packages/core's), the song's module, the intro's length in beats (0: the whole song loops).
# A song on a tape whose pace changes (synth.py's Ride: Boingo's, Ginger's, Alfil's) is handed over whole, as a loop: its
# start is part of the ride each time round. (The Hidden Boss's pieces are phases_v.py's.)
SONGS = [("grex", "song_m", 16, "Jefferson"), ("bigboy", "song_k", 0, "Big Boy"), ("hollow", "song_l", 16, "Hollow"), ("folio", "song_o", 54, "Folio"), ("zebra", "song_n", 16, "Don Dough"),
         ("sawyer", "song_p", 32, "Sawyer"), ("timber", "song_q", 32, "Timber"), ("moo", "song_r", 16, "Moo & Moon"), ("clown", "song_s", 0, "Boingo the Clown"),
         ("gingerbread", "song_t", 0, "Ginger"), ("alfil", "song_u", 0, "Alfil"), ("dash", "song_y", 0, "Dash"), ("gardener", "song_z", 0, "Puddles")]


def render(module: str, intro_beats: float, part: str) -> np.ndarray:
    """The song's float stereo mix with only the intro's notes ('intro') or only the others, wrapped to the loop ('loop')."""
    mod = importlib.import_module(module)
    Mix, init, put = synth.Mix, synth.Mix.__init__, synth.Mix.put
    got = {}

    def new_init(self, secs, beats, **kw):
        cut = intro_beats if part == "loop" else 0
        init(self, secs * (beats - cut) / beats, beats - cut, **kw)

    def new_put(self, bus, beat, x, pan=0.0):
        if part == "loop" and beat >= intro_beats - 1e-9:
            put(self, bus, beat - intro_beats, x, pan)
        elif part == "intro" and beat < intro_beats - 1e-9:
            put(self, bus, beat, x, pan)
        else:
            self.bus(bus)  # keep the bus, so the mix's levels and echoes find it

    Mix.__init__, Mix.put = new_init, new_put
    write = mod.write_wav
    mod.write_wav = lambda path, x, rate=synth.SR: got.update(x=x)
    try:
        mod.main("/dev/null")
    finally:
        Mix.__init__, Mix.put, mod.write_wav = init, put, write
    return got["x"]


def fold(x: np.ndarray) -> np.ndarray:
    """The mix folded to mono, kept as two equal channels (MONO), or as it is."""
    return np.repeat(x.mean(axis=0, keepdims=True), 2, axis=0) if MONO else x


def save(path: str, x: np.ndarray) -> None:
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[0]), w.setsampwidth(2), w.setframerate(synth.SR)
        w.writeframes((np.clip(x, -1, 1).T * 32767).astype("<i2").tobytes())


def ceiling(y: np.ndarray) -> np.ndarray:
    a = np.abs(y)
    k, c = master.KNEE, master.CEIL
    return np.where(a < k, y, np.sign(y) * (k + (c - k) * np.tanh((a - k) / (c - k))))


def main(out: str, *only: str) -> None:
    manifest = {"pad": PAD, "note": "Play <intro> once at t0. Start <loop> at t0 + introSeconds from offset pad, looping between pad and pad + loopSeconds.", "themes": {}}
    if only and os.path.exists(f"{out}/themes.json"):
        with open(f"{out}/themes.json") as f:
            manifest["themes"] = json.load(f)["themes"]
    for boss, module, intro_beats, name in SONGS:
        if only and boss not in only:
            continue
        mod = importlib.import_module(module)
        bpm = getattr(mod, "BPM", None)  # (none: a song whose pace changes, handed over whole)
        beat_s = 60 / bpm if bpm else 0.0
        loop = fold(render(module, intro_beats, "loop"))
        n_loop = loop.shape[1]
        intro = fold(render(module, intro_beats, "intro")) if intro_beats else np.zeros((2, 0))
        n_intro = int(round(intro_beats * beat_s * synth.SR))
        # One play-through, to set the gain: the intro and its tails, with one pass of the loop from the intro's end.
        once = np.zeros((2, n_intro + n_loop))
        once[:, : intro.shape[1]] += intro[:, : n_intro + n_loop]
        once[:, n_intro:] += loop
        gain = 0.0
        for _ in range(3):
            save(f"{out}/_once.wav", ceiling(once * 10 ** (gain / 20)) if gain else once / max(1.0, np.max(np.abs(once))))
            now = master.lufs(f"{out}/_once.wav") + (0 if gain else 20 * np.log10(max(1.0, np.max(np.abs(once)))))
            gain += master.TARGET - now
        g = 10 ** (gain / 20)
        # The pieces get the ceiling one by one, so where the intro's tails ring over the loop's first hits the sum can
        # pass it: turn the song down until that sum, with room for the encoders' overshoot, stays under -1 dBFS.
        both = np.zeros_like(once)
        for _ in range(4):
            both[:] = 0
            both[:, : intro.shape[1]] += ceiling(intro[:, : n_intro + n_loop] * g)
            both[:, n_intro:] += ceiling(loop * g)
            over = float(np.max(np.abs(both))) / HEADROOM
            if over <= 1:
                break
            g /= over
        files = {}
        pad = int(PAD * synth.SR)
        parts = {"loop": np.concatenate([loop[:, -pad:], loop, loop[:, :pad]], axis=1) * g}
        if intro_beats:
            keep = n_intro + int(TAIL * synth.SR)
            piece = intro[:, :keep] * g
            fade = int(0.5 * synth.SR)
            piece[:, -fade:] *= np.linspace(1, 0, fade)
            parts["intro"] = piece
        for part, x in parts.items():
            wav = f"{out}/{boss}-{part}.wav"
            save(wav, ceiling(x[:1] if MONO else x))
            for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "3"]), ("mp3", MP3)):
                subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", wav, *codec, f"{out}/{boss}-{part}.{ext}"], check=True)
            files[part] = f"{boss}-{part}"
        save(f"{out}/_once.wav", both)
        peak = float(np.max(np.abs(both)))
        manifest["themes"][boss] = {
            "boss": name,
            "source": f"scripts/reel/music/{module}.py",
            "intro": files.get("intro"),
            "loop": files["loop"],
            "introSeconds": round(n_intro / synth.SR, 6),
            "loopSeconds": round(n_loop / synth.SR, 6),
            "bpm": bpm,
            "lufs": round(master.lufs(f"{out}/_once.wav"), 1),
            "peakDb": round(float(20 * np.log10(peak)), 1),
        }
        print(boss, manifest["themes"][boss])
    subprocess.run(["rm", "-f", f"{out}/_once.wav"])
    with open(f"{out}/themes.json", "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
