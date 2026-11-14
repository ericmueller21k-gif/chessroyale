"""The Hidden Boss's music for the game, by his phase (Eric, Nov 12 and 13): the game-ready pieces, in the shape the
boss themes are handed over in (handoff.py: an intro played once and a loop, mono, OGG and MP3, entries in themes.json),
so the game's player (packages/app/src/music.ts) plays each as it plays any boss's theme.
How he laid it out: "we're gonna have three phases of him ... when you walk into this house ... and he's a child ...
it's playing ... that 1 minute version [song_w.py] ... when you actually beat him, we want to fade out the ... child
song, and then start into the score for the longer one [song_v.py] ... that middle ... part where it goes back to his
... childhood ... theme ... needs to only trigger when you beat him, because ... he does like an animation where he
... starts talking ... And then ... while he's doing his like phase three transformation ... it will turn into ...
that part where it starts to go all like off key ... right when he ... finishes his transformation and then like
splits the boards into four ... it starts into like the epic kind of drop ... then we continue the song, and then we
loop ... the epic play style ... And it basically never again does the childhood segment"; "we don't know how long
the games run ... every part should be self-contained, but also be able to be strung into the next part".
So four themes, each an intro (or none) and a loop, started one after another as the game reaches each point:

  recluse-house    his room, and the fight with the child      loop: the house's minute (song_w.py), 6 dB under the
                                                               other themes (where the same music sits in the score)
  recluse-phase2   the first fight after the child             once: the stare, long (song_v.py's LOOM, 1:10), then
                                                                     the calculation and the flag (1:59 in all)
                                                               loop: the chant, the duel, the book, the build again
  recluse-beaten   he's beaten; he talks (as long as it takes) once: the book slammed shut (1.8 s)
                                                               loop: the house's minute again (the same file)
  recluse-phase3   he transforms; the boards split; the rest   once: the souring at the game's pace (song_v.py's
                                                                     RAGE, 17.435 s): it ends on the drop, where
                                                                     the boards split
                                                               loop: the chant again (bigger) to the score's end

My calls (his to reverse): phase 2 keeps the score's first half and phase 3 its second, so the drop brings music the
player hasn't heard; phase 2's loop goes round through the build each time; phase 3's loop ends on the score's tag as
its breath before the chant comes back; and the talk has the house's loop, not the score's 31 seconds of memory, so
the talk can be any length (its text's pace is a setting) and only one length has to match: the souring's, from the
transformation's start to the boards' split. The session wiring it sent that length and the picture's beats (Nov 13,
from the phase change on main: he rises in a rage; his book lands open at 2.640 s; his chant runs from 3.040 s; arcs
at 8.540 s; the boards crack at 8.740 s), so the souring has a layout of its own for the game (song_v.py's RAGE: the
score's 19 seconds of it stay as they are). Two dips are put on it here, on the sound itself: a hush before the book
and a breath before the drop (the notes' tails ring through both otherwise): a full second of it, at Eric's word
("we need that pause longer like a full second it will make it more epic"). A new length: RAGE, and this again
(as when the director gave his chant two more lines, the same day: 17.435 s from his rising to the crack).
Phase 2's opening is longer than the score's (Eric, Nov 14, playing it: "when phase 2 boss starts the music is too
epic too fast"; about one more minute of the looming build-up before the epic part): the score's ten seconds of his
stare are seventy here (song_v.render with `loom`: made by itself, with its ring), and the calculation follows as it
is. The loop's own way round (the build again, after the book) is as it was: only the first time is longer.
Each piece is made by itself (song_v.render with a window: its notes only, their tails ringing on), so a cut never
slices an echo, and each loop begins with the ring of what leads into it; so an intro here stops dead at its
`introSeconds` (no tail of its own to overlap) and the loop starts there, as for every theme. The score's pieces share
the whole score's gain, so they sit together as they do in it.
  python3 phases_v.py [--stereo] [--kbps N] <the handoff's folder>   (handoff.py's options; about 10 minutes; themes.json there keeps its other themes)
"""
import gc
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

import master
import song_w
import handoff
from handoff import HEADROOM, PAD, ceiling, fold, save
from song_v import BEATS, LOOM, PLAN, RAGE, T_CALC, T_CHANT, T_CHANT2, T_MEMORY, TAPE, rage_layout, rage_plan, render
from synth import SR, Ride

RING = 8.0  # seconds of ring-out carried over a join
HOUSE_DB = -6.0  # the house's loop against the themes' level
EDGE = 0.03  # a piece that stops dead, or starts mid-ring, is faded over this long


def level(x: np.ndarray, target: float, tmp: str) -> float:
    """The gain that puts `x`, through the ceiling, at `target` LUFS."""
    g = 0.5 / float(np.max(np.abs(x)))
    for _ in range(4):
        save(tmp, ceiling(x * g))
        g *= 10 ** ((target - master.lufs(tmp)) / 20)
    return g


def main(out: str) -> None:
    clock = Ride(PLAN, BEATS, None, tape_secs=TAPE)  # for when each beat is heard
    n = lambda beat: int(round(clock.when(beat) * SR))
    secs = lambda a, b: round((n(b) - n(a)) / SR, 6)
    ring = int(RING * SR)
    edge = np.linspace(0, 1, int(EDGE * SR))

    def piece(a, b):
        got = fold(render((a, b), 0))
        gc.collect()
        return got

    def body(h, a, b):
        return h[:, n(a):n(b)].copy()

    def after(h, b):
        """What rings on after a beat (round the tape's end, if it's the last)."""
        return np.take(h, np.arange(n(b), n(b) + ring), axis=1, mode="wrap")

    loom = fold(render(loom=True))  # the game's longer stare, and ten seconds of its ring
    gc.collect()
    start = piece(0, T_CHANT)  # the score's own opening (the stare, the calculation, the flag): for its ring and the score's gain
    build = piece(T_CALC, T_CHANT)  # the calculation and the flag without the stare's ring
    first = piece(T_CHANT, T_MEMORY + 0.001)  # the chant, the duel, and the book that stops them
    beaten = piece(T_MEMORY, T_CHANT2)  # the book, the memory, its souring, the pause
    last = piece(T_CHANT2, BEATS)  # from the drop to the end
    RAGE_AT = rage_layout()[0]  # the beat he rises at; the book lands five beats on, the build starts six on, the breath is the last
    RAGE_SLAM, RAGE_BUILD, RAGE_BREATH = RAGE_AT + 5, RAGE_AT + 6, T_CHANT2 - 1
    rage = fold(render((RAGE_AT, T_CHANT2), 0, rage=RAGE))  # the souring at the game's pace
    gc.collect()
    house = fold(song_w.render())

    intro2 = np.concatenate([loom[:, : LOOM * SR], body(build, T_CALC, T_CHANT)], axis=1)  # the long stare, then the calculation and the flag
    intro2[:, LOOM * SR : LOOM * SR + ring] += loom[:, LOOM * SR : LOOM * SR + ring]  # the stare's ring, over the calculation's first bars
    intro2[:, -len(edge):] *= edge[::-1]
    loop2 = np.concatenate([body(first, T_CHANT, T_MEMORY), body(build, T_CALC, T_CHANT)], axis=1)
    join = n(T_MEMORY) - n(T_CHANT)
    loop2[:, join : join + ring] += after(first, T_MEMORY)  # the duel's ring and the book, over the build's first bars
    loop2[:, :ring] += after(start, T_CHANT)  # the flag's ring, over the chant's first bar: as the intro leaves it
    slam = body(beaten, T_MEMORY, T_MEMORY + 2)  # the book and its ring, up to where the memory's tune began
    out_s = int(0.6 * SR)
    slam[:, -out_s:] *= np.linspace(1, 0, out_s)
    game = Ride(rage_plan(), BEATS, None, tape_secs=TAPE)  # the game's cut has its own clock from its start to the drop
    at = lambda beat: round(game.when(beat) - game.when(RAGE_AT), 3)
    intro3 = rage[:, int(round(game.when(RAGE_AT) * SR)) : int(round(game.when(T_CHANT2) * SR))].copy()
    # (The hush before the book: down, held, and back. The breath before the drop, its one tick left as it is: down,
    # and on down to nothing, so most of its second is silence.)
    t = np.arange(intro3.shape[1]) / SR
    for down, low, up, depth, fall in ((at(RAGE_AT + 4) - 0.06, at(RAGE_AT + 4) + 0.06, at(RAGE_SLAM) - 0.006, 0.12, None),
                                       (at(RAGE_BREATH) + 0.06, at(RAGE_BREATH) + 0.12, at(T_CHANT2), 0.25, 0.12)):
        dip = (1 - depth) * np.clip((t - down) / (low - down), 0, 1) * np.clip((up - t) / 0.005, 0, 1)
        intro3 *= (1 - dip) * (np.exp(-np.clip(t - low, 0, None) / fall) if fall else 1)
    loop3 = body(last, T_CHANT2, BEATS)
    loop3[:, :ring] += after(last, BEATS)  # the tag's ring, over the chant's first bar

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "x.wav")
        # The whole score's gain: the pieces together are the score (the book at the memory twice, which moves nothing).
        g = level(start + first + beaten + last, master.TARGET, wav)
        # (A little down, towards the handoff's headroom: an encoder's overshoot then stays under full scale.)
        g *= min(1.0, HEADROOM / max(float(np.max(np.abs(ceiling(x * g)))) for x in (intro2, loop2, slam, intro3, loop3)))
        gh = level(house, master.TARGET, wav) * 10 ** (HOUSE_DB / 20)
        files = {"recluse-phase2-intro": intro2 * g, "recluse-phase2-loop": loop2 * g, "recluse-beaten-intro": slam * g, "recluse-phase3-intro": intro3 * g,
                 "recluse-phase3-loop": loop3 * g, "recluse-house-loop": house * gh}
        pad = int(PAD * SR)
        for name, x in files.items():
            x = files[name] = ceiling(x)
            if name.endswith("-loop"):
                x = np.concatenate([x[:, -pad:], x, x[:, :pad]], axis=1)
            save(wav, x[:1] if handoff.MONO else x)
            for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "3"]), ("mp3", handoff.MP3)):
                subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", wav, *codec, f"{out}/{name}.{ext}"], check=True)

        def theme(what, source, intro, loop, **more):
            a, b = (files[intro] if intro else np.zeros((2, 0))), files[loop]
            once = np.concatenate([a, b], axis=1)  # one play-through: the intro, then one pass of the loop
            save(wav, once)
            return {"boss": what, "source": f"scripts/reel/music/{source}", "intro": intro, "loop": loop, "introSeconds": round(a.shape[1] / SR, 6),
                    "loopSeconds": round(b.shape[1] / SR, 6), "bpm": None, "lufs": round(master.lufs(wav), 1), "peakDb": round(float(20 * np.log10(np.max(np.abs(once)))), 1), **more}

        themes = {
            "recluse-house": theme("Hidden Boss: his room, and the fight with the child", "song_w.py", None, "recluse-house-loop"),
            "recluse-phase2": theme("Hidden Boss: the first fight after the child", "song_v.py (phases_v.py)", "recluse-phase2-intro", "recluse-phase2-loop",
                                    marks={"calculation": float(LOOM), "buildAgain": secs(T_CHANT, T_MEMORY)}),
            "recluse-beaten": theme("Hidden Boss: beaten; he talks", "song_v.py, song_w.py (phases_v.py)", "recluse-beaten-intro", "recluse-house-loop"),
            "recluse-phase3": theme("Hidden Boss: he transforms (the intro), the boards split (the loop starts), the rest of the fight", "song_v.py (phases_v.py)",
                                    "recluse-phase3-intro", "recluse-phase3-loop",
                                    marks={"pause": at(RAGE_AT + 4), "slam": at(RAGE_SLAM), "build": at(RAGE_BUILD), "breath": at(RAGE_BREATH), "drop": at(T_CHANT2)}),
        }
    path = f"{out}/themes.json"
    manifest = {"pad": PAD, "note": "Play <intro> once at t0. Start <loop> at t0 + introSeconds from offset pad, looping between pad and pad + loopSeconds.", "themes": {}}
    if os.path.exists(path):
        with open(path) as f:
            manifest = json.load(f)
    manifest["themes"].update(themes)
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    for key, t in themes.items():
        print(key, t)


if __name__ == "__main__":
    main(*handoff.options(sys.argv[1:]))
