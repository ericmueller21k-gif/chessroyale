"""The Hidden Boss's score (song_v.py) cut into the pieces the game plays, by his phase (Eric, Nov 12).
How he laid it out: "we're gonna have three phases of him ... when you walk into this house ... and he's a child ...
it's playing ... that 1 minute version [song_w.py] ... when you actually beat him, we want to fade out the ... child
song, and then start into the score for the longer one ... that middle ... part where it goes back to his ...
childhood ... theme ... needs to only trigger when you beat him, because ... he does like an animation where he ...
starts talking ... it'll basically be only about 20 seconds or 30 seconds of ... that childhood theme. And then ...
while he's doing his like phase three transformation ... it will turn into ... that part where it starts to go all
like off key ... right when he ... finishes his transformation and then like splits the boards into four ... it
starts into like the epic kind of drop ... then we continue the song, and then we loop ... the epic play style ...
And it basically never again does the childhood segment ... they don't have to be exact."
So each phase is a piece played once and a piece that loops:

  phase 1  (the child, in his house)   loop: track W (song_w.py). The same music sits about 6 dB lower inside the
                                       score, so the game plays this loop about 6 dB down ("house_gain_db").
  phase 2  (the first fight)           once: the stare, the calculation, the flag (0:00 to 0:59 of the score)
                                       loop: the chant, the duel, the book slammed, the calculation again, the flag
  phase 3  (he's beaten: he talks,     once: the book slammed, the memory, its souring, the pause (1:39 to 2:29);
            transforms, splits the           the drop is where this piece ends
            boards)                    loop: the chant again (bigger), the duel, the choir alone, the climb, the
                                             last theme, the tag: from the drop to the score's end

My calls (his to reverse): phase 2 keeps the score's first half and phase 3 its second, so the drop at the boards'
split brings music the player hasn't heard; phase 2's loop goes round through the build each time (a breather, and
the flag into the chant each time) rather than the chant and duel alone; phase 3's loop ends on the score's tag (the
book, the clock slowing) as its breath before the chant comes back.
Every join is "start the next file the moment this one ends": a piece played once stops dead where the next starts,
and each loop begins with the ring of what leads into it, so nothing is cut off. The one free join is into phase 3's
first piece, which starts on the book's slam: stop phase 2's loop wherever it is (a quick fade) and play it.
When Eric sends the animation's times, the memory and the souring are re-timed in song_v.py to fit and this is run
again.
Each piece is made by itself (song_v.render with a window: its notes only, their tails ringing on), so a cut never
slices an echo; all take the whole score's gain (master.py), so they sit together as they do in the score.
  python3 phases_v.py <out folder>   ->  track-V-phase{2,3}-{intro,loop}.wav, track-V-phases.json   (about 9 minutes)
"""
import gc
import json
import os
import sys
import tempfile

import numpy as np

import master
from song_v import BEATS, PLAN, T_CALC, T_CHANT, T_CHANT2, T_MEMORY, T_PAUSE, T_SPIRAL, TAPE, render
from synth import SR, Ride, write_wav

RING = 8.0  # seconds of ring-out carried over a join


def main(out: str) -> None:
    clock = Ride(PLAN, BEATS, None, tape_secs=TAPE)  # for when each beat is heard
    n = lambda beat: int(round(clock.when(beat) * SR))
    ring = int(RING * SR)

    def piece(a, b):
        got = render((a, b), 0)
        gc.collect()
        return got

    def body(h, a, b):
        return h[:, n(a):n(b)].copy()

    def after(h, b):
        """What rings on after a beat (round the tape's end, if it's the last)."""
        return np.take(h, np.arange(n(b), n(b) + ring), axis=1, mode="wrap")

    start = piece(0, T_CHANT)  # the stare, the calculation, the flag
    build = piece(T_CALC, T_CHANT)  # the calculation and the flag without the stare's ring
    first = piece(T_CHANT, T_MEMORY + 0.001)  # the chant, the duel, and the book that stops them
    beaten = piece(T_MEMORY, T_CHANT2)  # the book, the memory, its souring, the pause
    last = piece(T_CHANT2, BEATS)  # from the drop to the end

    # The whole score's gain: the pieces together are the score (the book at the memory twice, which moves nothing).
    whole = start + first + beaten + last
    with tempfile.TemporaryDirectory() as tmp:
        write_wav(os.path.join(tmp, "raw.wav"), whole)
        gain = min(1.0, 0.98 / float(np.max(np.abs(whole)))) * 10 ** (master.main(os.path.join(tmp, "raw.wav"), os.path.join(tmp, "out.wav")) / 20)
    del whole

    fade = np.linspace(0, 1, int(0.002 * SR))
    intro2 = body(start, 0, T_CHANT)
    loop2 = np.concatenate([body(first, T_CHANT, T_MEMORY), body(build, T_CALC, T_CHANT)], axis=1)
    join = n(T_MEMORY) - n(T_CHANT)
    loop2[:, join : join + ring] += after(first, T_MEMORY)  # the duel's ring and the book, over the build's first bars
    loop2[:, :ring] += after(start, T_CHANT)  # the flag's ring, over the chant's first bar: as the first piece leaves it
    intro3 = body(beaten, T_MEMORY, T_CHANT2)
    intro3[:, : len(fade)] *= fade
    loop3 = body(last, T_CHANT2, BEATS)
    loop3[:, :ring] += after(last, BEATS)  # the tag's ring, over the chant's first bar

    marks = {"house_gain_db": -6.0}
    for name, x in (("phase2-intro", intro2), ("phase2-loop", loop2), ("phase3-intro", intro3), ("phase3-loop", loop3)):
        y = master.ceiling(x * gain)
        path = os.path.join(out, f"track-V-{name}.wav")
        write_wav(path, y)
        marks[name] = {"file": f"track-V-{name}", "secs": round(y.shape[1] / SR, 3)}
        print(f"{name}: {y.shape[1] / SR:.2f} s, {master.lufs(path):.1f} LUFS, peak {20 * np.log10(np.max(np.abs(y))):.1f} dBFS, jump across its ends {np.max(np.abs(y[:, 0] - y[:, -1])):.4f}")
    secs = lambda a, b: round((n(b) - n(a)) / SR, 3)
    marks["phase2-loop"]["build_at"] = secs(T_CHANT, T_MEMORY)  # the book; the calculation starts again
    marks["phase3-intro"].update(memory_at=0.0, sours_at=secs(T_MEMORY, T_SPIRAL), pause_at=secs(T_MEMORY, T_PAUSE), drop_at=secs(T_MEMORY, T_CHANT2))
    with open(os.path.join(out, "track-V-phases.json"), "w") as f:
        json.dump(marks, f, indent=2)
    print(json.dumps(marks))


if __name__ == "__main__":
    main(sys.argv[1])
