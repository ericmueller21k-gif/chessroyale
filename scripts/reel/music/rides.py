"""Sounds for the town's rides, while they move (Eric, Nov 14): "we've got like riders for everyone in this town ... I'm
on like a bulldozer, and ... I need like a sound. So when you move around ... it sounds like ... a little bulldozer
moving ... we can keep going probably with our normal, like chiptune style ... maybe you could give me like 5
different ... I don't think we need an idle ... just like a moving sound ... would it be like a little startup sound
every time you press like an arrow key ...? But that doesn't make necessarily sense for like a pogo stick ... I think
we just need like one continuous sound ... I don't know how long the sample needs to be".
The shape proposed: one short loop a ride (0.75 to 2 s, seamless: every part of it is made to come round, so it can
repeat for as long as a key is held), started with a quick fade as the pawn starts moving and faded as it stops; no
separate start-up sample. An engine gets its start-up from the loop itself, played a little slow and brought up to
speed over a third of a second, and sinks as it stops; a bouncing ride starts on a bounce and stops after one. The
town's step is 90 ms (eleven squares a second), far too quick to sound once a step, so a loop has its own pace.
Made soft, as the game's sounds are (they pass a 6 kHz low-pass there: the samples here have had the same), and with
their character between 150 Hz and 2 kHz, where a phone's speaker has it.
The sketches to choose from: five for Sawyer's Dozer, three for Boingo's Pogo. His picks (Nov 14): for the dozer,
"I like the diesel chug slightly better" (than the rumble and squeak, his first); for the pogo, "the first one ...
just the regular boing". These two go to the game first ("we want to kind of test this on two of them here, and then
we'll kind of go more. I want to move around with it and see how it feels"); and stopping: "when you stop moving, it
doesn't just like instantly stop ... it kind of fades over like a second or whatever ... we'll have to test it".
  python3 rides.py <out folder>          (the sketches: each as <name>.wav, moving, a stop, moving again; and <name>-loop.wav)
  python3 rides.py --game <out folder>   (the chosen loops for the game: <ride id>.wav and rides.json; see `handoff`)
"""
import sys
import wave

import numpy as np

SR = 48000
TAU = 2 * np.pi


def secs(n):
    return np.arange(n) / SR


def colored(n, lo, hi, seed):
    """Noise between two pitches, made in a ring: it comes round without a seam. Its loudness (RMS) is 1."""
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n, 1 / SR)
    shape = 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** 6) / np.sqrt(1 + (f / hi) ** 6)
    x = np.fft.irfft(shape * np.exp(1j * rng.uniform(0, TAU, len(f))), n)
    return x / np.sqrt(np.mean(x**2))


def lowpass(x, cut, order=2):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (f / cut) ** (2 * order)), len(x))


def highpass(x, cut, order=2):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (cut / np.maximum(f, 1e-6)) ** (2 * order)), len(x))


def strikes(n, hits, kernel):
    """A sound (`kernel`) put down at each of `hits` (seconds, loudness), round the ring."""
    marks = np.zeros(n)
    for at, loud in hits:
        marks[int(round(at * SR)) % n] += loud
    k = np.zeros(n)
    k[: min(n, len(kernel))] = kernel[:n]
    return np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(k), n)


def waves(phase, duty=None, top=5000.0, f0=100.0):
    """A sawtooth (or, with `duty`, a pulse) from its phase, built from its harmonics up to `top` Hz (no hash)."""
    out = np.zeros(len(phase))
    for h in range(1, int(top / f0) + 1):
        out += np.sin(h * phase) * ((np.sin(np.pi * h * duty) if duty else 1.0) / h)
    return out


def burst(length, tau, attack=0.001):
    t = secs(int(length * SR))
    return np.exp(-t / tau) * np.minimum(1, t / attack)


# ---- Sawyer's Dozer: five ----
def dozer_chug():
    """A diesel's chug: twelve firings a second, strong and weak by turns, a low buzz in each; its exhaust; the tracks ticking."""
    n = SR
    t = secs(n)
    fire = strikes(n, [(i / 12, 1.0 if i % 2 == 0 else 0.7) for i in range(12)], burst(0.2, 0.03))
    body = np.tanh(2.2 * waves(TAU * 48 * t, 0.25, 2000, 48) * fire)
    exhaust = colored(n, 300, 1400, 1) * fire**1.5
    tick = (np.sin(TAU * 1700 * secs(2400)) + 0.6 * np.sin(TAU * 2650 * secs(2400))) * burst(0.05, 0.006)
    tread = strikes(n, [(i / 6 + 1 / 24, 0.8 + 0.2 * np.sin(2.3 * i)) for i in range(6)], tick)
    return highpass(body + 0.35 * exhaust + 0.1 * tread, 70)


def dozer_rumble():
    """A steady rumble, the tracks thudding eight times a second, and now and then a track's squeak."""
    n = 2 * SR
    t = secs(n)
    rumble = colored(n, 50, 260, 2) * (0.8 + 0.2 * np.sin(TAU * 2 * t)) + 0.5 * (2 / np.pi) * np.arcsin(np.sin(TAU * 55 * t))
    thud = colored(int(0.12 * SR), 150, 600, 3) * burst(0.12, 0.022)
    tread = strikes(n, [(i / 8, 0.7 + 0.3 * (i % 2)) for i in range(16)], thud)
    k = int(0.08 * SR)
    u = np.linspace(0, 1, k)
    ph = TAU * np.cumsum(950 + 500 * u) / SR
    squeak = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.sin(np.pi * u) ** 1.2
    return rumble + 0.9 * tread + 0.22 * strikes(n, [(0.45, 1.0), (1.52, 0.8)], squeak)


def dozer_putt():
    """Putt-putt: a small one-cylinder engine, eight hollow pops a second, strong and weak, a puff from the stack after each strong one."""
    n = SR
    k = int(0.14 * SR)
    t = secs(k)

    def pop(pitch):
        tone = np.sin(TAU * np.cumsum(pitch * (95 + 90 * np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.035)
        return (tone + 0.5 * colored(k, 300, 650, 4) * np.exp(-t / 0.012)) * np.minimum(1, t / 0.001)

    strong = strikes(n, [(i / 4, 1.0) for i in range(4)], pop(1.0))
    weak = strikes(n, [(i / 4 + 1 / 8, 0.6) for i in range(4)], pop(1.12))
    puff = strikes(n, [(i / 4 + 0.03, 1.0) for i in range(4)], colored(int(0.1 * SR), 1500, 4000, 5) * burst(0.1, 0.03, 0.004))
    return strong + weak + 0.16 * puff


def dozer_heavy():
    """A big diesel: a low growl beating eighteen times a second, a rumble under it, a faint whine over it, the treads' slow clank."""
    n = int(1.5 * SR)
    t = secs(n)
    fire = strikes(n, [(i / 18, 1.0) for i in range(27)], burst(0.1, 0.02))
    growl = np.tanh(3.0 * (waves(TAU * 36 * t, None, 1500, 36) + 0.6 * waves(TAU * 72 * t, None, 1500, 72)) * (0.3 + 0.7 * fire) * 0.5)
    growl = lowpass(highpass(growl, 80), 1200)
    whine = 0.03 * np.sin(TAU * 1240 * t) * (0.7 + 0.3 * np.sin(TAU * (2 / 1.5) * t))
    kt = secs(int(0.2 * SR))
    clank = (np.sin(TAU * 620 * kt) + 0.7 * np.sin(TAU * 960 * kt) + 0.4 * np.sin(TAU * 1480 * kt)) * burst(0.2, 0.03)
    return growl + 0.4 * colored(n, 60, 180, 6) + whine + 0.2 * strikes(n, [(0.1, 1.0), (0.6, 0.8), (1.1, 0.9)], clank)


def dozer_toy():
    """A toy's motor, the old consoles' way: a pulse wave flicking between two notes twenty-four times a second, and a ratchet's tick."""
    n = int(0.75 * SR)
    t = secs(n)
    seg = (np.arange(n) // (SR // 24)) % 2  # which of the two notes
    f = np.where(seg == 0, 120.0, 168.0)  # five and seven whole waves a flick: no seam
    phase = TAU * np.cumsum(f) / SR
    motor = sum(np.sin(h * phase) * np.sin(np.pi * h * 0.25) / h for h in range(1, 30)) * (0.75 + 0.25 * np.sign(np.sin(TAU * 12 * t)))
    click = colored(int(0.02 * SR), 2000, 5000, 7) * burst(0.02, 0.003)
    return lowpass(motor, 4000) + 0.25 * strikes(n, [(i / 12, 1.0) for i in range(9)], click)


# ---- Boingo's Pogo: three. Four bounces a second, a little tune in their pitches. ----
def landing():
    return colored(int(0.06 * SR), 120, 400, 8) * burst(0.06, 0.012)


def pogo_boing():
    """Boing: a spring as the game's clown has it (a note whose pitch drops, then wobbles fast and settles), on every bounce."""
    n = SR
    out = np.zeros(n)
    k = int(0.24 * SR)
    t = secs(k)
    for i, base in enumerate((330, 370, 330, 415)):
        f = base * (1 + 0.35 * np.sin(TAU * 22 * t) * np.exp(-t / 0.07)) + 160 * np.exp(-t / 0.025)
        out += strikes(n, [(i / 4, 1.0)], np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.09) * np.minimum(1, t / 0.002))
    return out + 0.3 * strikes(n, [(i / 4, 1.0) for i in range(4)], landing())


def pogo_chip():
    """A hop the old consoles' way: a square wave leaping up an octave, and the landing's pat."""
    n = SR
    out = np.zeros(n)
    k = int(0.2 * SR)
    t = secs(k)
    for i, base in enumerate((262, 294, 262, 330)):
        phase = TAU * np.cumsum(base * 2 ** np.minimum(1, t / 0.07)) / SR
        out += strikes(n, [(i / 4, 1.0)], sum(np.sin(h * phase) / h for h in range(1, 12, 2)) * np.exp(-t / 0.06) * np.minimum(1, t / 0.002))
    return out + 0.4 * strikes(n, [(i / 4, 1.0) for i in range(4)], landing())


def pogo_twang():
    """A steel spring: a clang of three pitches that don't agree, sinking and shivering, on every bounce."""
    n = SR
    k = int(0.24 * SR)
    t = secs(k)
    bend = 2 ** (-3 * np.minimum(1, t / 0.15) / 12)
    spring = sum(a * np.sin(TAU * np.cumsum(210 * r * bend) / SR) for r, a in ((1, 1.0), (2.41, 0.6), (3.88, 0.35)))
    spring = spring * (0.7 + 0.3 * np.sin(TAU * 28 * t)) * np.exp(-t / 0.1) * np.minimum(1, t / 0.001)
    return strikes(n, [(i / 4, 1.0 if i % 2 == 0 else 0.8) for i in range(4)], spring) + 0.35 * strikes(n, [(i / 4, 1.0) for i in range(4)], landing())


SKETCHES = [("dozer-1-diesel-chug", dozer_chug, True), ("dozer-2-rumble-and-squeak", dozer_rumble, True), ("dozer-3-putt-putt", dozer_putt, True),
            ("dozer-4-heavy-growl", dozer_heavy, True), ("dozer-5-toy-motor", dozer_toy, True),
            ("pogo-1-boing", pogo_boing, False), ("pogo-2-chip-hop", pogo_chip, False), ("pogo-3-steel-spring", pogo_twang, False)]
LEVEL = 0.1  # every loop's loudness (RMS), after the game's low-pass


def finished(loop):
    """A loop as the game would have it: through its 6 kHz low-pass, at the common level. Its deepest part (under
    about 120 Hz) is thinned first: a phone's speaker has none of it, and the music's bass lives there."""
    loop = highpass(lowpass(loop, 6000), 120)
    return loop / np.sqrt(np.mean(loop**2)) * LEVEL


def moving(loop, length, engine):
    """`length` seconds of a ride moving: the loop round and round. An engine starts a little slow and comes up to
    speed over a third of a second, and sinks as it stops; either fades in and out quickly."""
    n = int(length * SR)
    t = secs(n)
    rate = np.ones(n)
    if engine:
        rate = 0.8 + 0.2 * np.minimum(1, t / 0.3) - 0.12 * np.clip((t - (length - 0.22)) / 0.22, 0, 1)
    pos = np.cumsum(rate) % len(loop)
    i = pos.astype(int)
    out = loop[i] + (pos - i) * (loop[(i + 1) % len(loop)] - loop[i])
    return out * np.minimum(1, t / 0.06) * np.minimum(1, (length - t) / (0.2 if engine else 0.12))


def save(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


# The loops chosen for the game, by the ride's id (crates.ts): the sketch, whether it is an engine, and how long its
# fade is as the pawn stops, to start from (seconds: Eric's "like a second or whatever", to be tried in the town).
CHOSEN = {"sawyer-dozer": (dozer_chug, True, 0.7), "boingo-pogo": (pogo_boing, False, 0.35)}
GAME_SR = 24000  # the loops have nothing over 6 kHz, so half the samples carry all of them
GAME_PAD = 0.1  # seconds of the loop's end before it and of its start after it: the loop is played between them


def handoff(out):
    """The chosen loops as the game takes them: mono WAV at 24 kHz (a WAV has no silence added at its ends, so it
    can loop), each with `pad` seconds of itself on either side so that a decoder's change of sample rate has real
    sound to work from at both ends of the loop; and rides.json: for each ride, its file, where its loop is, and how
    to start and stop it."""
    import json

    rides = {}
    for ride, (make, engine, fade) in CHOSEN.items():
        loop = finished(make())
        half = np.fft.irfft(np.fft.rfft(loop)[: len(loop) // 4 + 1], len(loop) // 2) * 0.5  # the same loop at 24 kHz, still a ring
        pad = int(GAME_PAD * GAME_SR)
        with wave.open(f"{out}/{ride}.wav", "wb") as w:
            w.setnchannels(1), w.setsampwidth(2), w.setframerate(GAME_SR)
            w.writeframes((np.clip(np.concatenate([half[-pad:], half, half[:pad]]), -1, 1) * 32767).astype("<i2").tobytes())
        rides[ride] = {"file": f"{ride}.wav", "loopStart": GAME_PAD, "loopEnd": round(GAME_PAD + len(half) / GAME_SR, 6), "engine": engine,
                       "fadeInMs": 60, "fadeOutMs": int(fade * 1000), "rmsDb": round(float(20 * np.log10(np.sqrt(np.mean(half**2)))), 1),
                       "peakDb": round(float(20 * np.log10(np.abs(half).max())), 1)}
        print(ride, rides[ride])
    with open(f"{out}/rides.json", "w") as f:
        json.dump({"note": "Play <file> looping between loopStart and loopEnd (seconds), starting at loopStart. See README.md.", "rides": rides}, f, indent=2)
        f.write("\n")


def main(out):
    for name, make, engine in SKETCHES:
        loop = finished(make())
        save(f"{out}/{name}-loop.wav", loop)
        demo = np.concatenate([moving(loop, 1.75, engine), np.zeros(int(0.5 * SR)), moving(loop, 2.5, engine), np.zeros(int(0.2 * SR))])
        save(f"{out}/{name}.wav", demo)
        seam = abs(loop[0] - loop[-1])
        print(f"{name:28} loop {len(loop) / SR:.2f} s  peak {20 * np.log10(np.abs(loop).max()):6.1f} dB  across its seam {seam:.4f} (largest step inside {np.abs(np.diff(loop)).max():.4f})")


if __name__ == "__main__":
    handoff(sys.argv[2]) if sys.argv[1] == "--game" else main(sys.argv[1])
