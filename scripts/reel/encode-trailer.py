#!/usr/bin/env python3
"""Cuts the trailer (Eric, Nov 11: trailer v2) out of the scenes scripts/reel/record-reel.ts recorded (reports/demo/<scene>/ for the
phone, <scene>-wide/ for a computer), on the music's grid (scripts/reel/music/timeline.py: 150 beats a minute, a beat 0.4 s), and
lays each soundtrack under it. Writes reports/trailer/trailer-{phone,wide}.mp4 (silent) and, for each track given, -A / -B.

Each clip names its scene, where it starts and ends in the recording ("mark+seconds": the scene's marks.json says when each moment
happened, so a new recording needs no retiming) and how many beats it fills; its speed follows from those. Retune a cut here.

  scripts/reel/encode-trailer.py [phone|wide|both] [A=track-A.wav B=track-B.wav]
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "reports/demo"
OUT = ROOT / "reports/trailer"
BEAT = 0.4
FPS = 30

# (scene, from, to, beats). A clip before a crossfade is rendered that much longer at the same speed.
# Scenes: name, caption (captions[-wide]/cN.png, or None), how it comes in ("cut", or a crossfade's seconds), clips.
SCENES = [
    # 1. 50 v 50: your pick, the team's picks coming in, the reveal, the move played.
    ("crowd", 1, "cut", [("crowd", "picked0-1.3", "picked0+3.5", 12)]),
    # 2. Today's town by day: the run from the park past the Colosseum, along Colosseum Row and back by Fountain Street; the chat moving.
    ("town", 2, 0.3, [("town", "run+0.5", "runEnd", 24)]),
    # 3. The same town at night, on Moon's Ride.
    ("night", 3, 0.6, [("night", "ride+0.5", "rideEnd", 12)]),
    # 4. Big Boy: his card, in at his door with him, his blocks building the table, his candy swirl over the whole screen.
    (
        "bigboy",
        4,
        "cut",
        [
            ("bigboy", "arrived-0.2", "confirm-0.3", 2),
            ("bigboy", "fight+0.2", "room-0.1", 2),
            ("bigboy", "intro:line+0.3", "intro:done", 8),
            ("bigboy", "intro:done", "match:boss+1.4", 4),
        ],
    ),
    # 5. The boss mashup: four cuts of six beats.
    (
        "mashup",
        5,
        0.4,
        [
            ("hollow", "intro:drink+1.2", "intro:black+0.4", 6),
            ("boss-alfil", "ev:fuse-0.2", "ev:fuse+2.8", 6),
            ("boss-bigboy", "ev:bounce+1.2", "ev:bounce+5.6", 6),
            ("boss-sawyer", "ev:boardsaw+2.4", "ev:boardsaw+6.0", 6),
        ],
    ),
    # 6. Squads: the round's card, your move on your board, the three boards over it.
    ("squads", 6, 0.3, [("squads", "duty0-2.4", "moved0+4.0", 12)]),
    # 7. Ranked: a few moves of the duel, then the run up the ranks to Transcendent (its start exactly on beat 107).
    ("duel", 7, 0.3, [("ranked", "move1-0.5", "move5+0.3", 7)]),
    ("ranks", 8, "cut", [("ranks", "start", "start+3.6", 9)]),
    # 8. The Hidden Boss: no caption, a very slow zoom in, the end fading to black.
    ("hidden", None, 0.5, [("hidden", "start+0.5", "start+8.5", 20)]),
]
# The Hidden Boss's zoom: how far in by the end, and the point it closes on (shares of the frame: his hood).
ZOOM = 0.16
ZOOM_AT = {"phone": (0.585, 0.40), "wide": (0.49, 0.42)}
KINDS = {
    # 860 x 1544: a phone's full width at 2x (the recordings are 975 x 1750, the phone's top 700 CSS px at 2.5x).
    "phone": dict(sfx="", w=860, h=1544, cap_bottom=1478, crf=24),
    # 1920 x 1080: a computer's window, the game's computer layouts.
    "wide": dict(sfx="-wide", w=1920, h=1080, cap_bottom=1050, crf=21),
}


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args], check=True)


def marks(scene: str, sfx: str) -> dict[str, float]:
    raw = json.loads((DEMO / f"{scene}{sfx}" / "marks.json").read_text())
    out: dict[str, float] = {}
    for k, v in raw.items():
        out.setdefault(k, v)
        out.setdefault(k.split(" ")[0], v)  # "moved0 g1f3": by "moved0" too
        # (A boss battle's marks carry the whole state, "boss ev:warn+bounce": each event's first time by its own name too.)
        if " ev:" in k or k.startswith("ev:"):
            for e in k.split("ev:")[1].split("+"):
                out.setdefault(f"ev:{e}", v)
    return out


def at(scene: str, sfx: str, spec: str | float) -> float:
    if isinstance(spec, (int, float)):
        return float(spec)
    m = marks(scene, sfx)
    for sign in ("+", "-"):
        name, _, off = spec.rpartition(sign)
        if name in m and off.replace(".", "").isdigit():
            return m[name] + float(sign + off)
    if spec in m:
        return m[spec]
    raise SystemExit(f"{scene}{sfx}: no mark for {spec!r} (it has {', '.join(m)})")


def encode(kind: str, tracks: dict[str, str]) -> None:
    K = KINDS[kind]
    sfx, W, H = K["sfx"], K["w"], K["h"]
    seg = OUT / f"segments-{kind}"
    seg.mkdir(parents=True, exist_ok=True)
    fades = [s[2] if s[2] != "cut" else 0.0 for s in SCENES] + [0.0]
    files, starts, t = [], [], 0.0
    for i, (name, cap, _, clips) in enumerate(SCENES):
        extra = fades[i + 1]  # the next scene fades in over this one's tail
        parts = []
        for j, (scene, a, b, beats) in enumerate(clips):
            a, b = at(scene, sfx, a), at(scene, sfx, b)
            secs = beats * BEAT
            speed = (b - a) / secs
            tail = extra if j == len(clips) - 1 else 0.0
            frames = round((secs + tail) * FPS)
            vf = f"trim=start={a:.3f}:end={b + tail * speed + 0.5:.3f},setpts=(PTS-STARTPTS)/{speed:.5f},fps={FPS},scale={W}:{H}:flags=lanczos"
            if name == "hidden":
                zx, zy = ZOOM_AT[kind]
                n = frames - 1
                vf += f",scale={W * 2}:{H * 2}:flags=lanczos,zoompan=z='1+{ZOOM}*on/{n}':x='(iw-iw/zoom)*{zx}':y='(ih-ih/zoom)*{zy}':d=1:s={W}x{H}:fps={FPS}"
            vf += ",tpad=stop_mode=clone:stop_duration=2,format=yuv420p"
            part = seg / f"{name}-{j}.mp4"
            run("-f", "concat", "-safe", "0", "-i", str(DEMO / f"{scene}{sfx}" / "frames.txt"), "-vf", vf, "-frames:v", str(frames), "-c:v", "libx264", "-preset", "fast", "-crf", "10", "-an", str(part))
            parts.append(part)
            print(f"{kind} {name}-{j}: {scene} {a:.2f}-{b:.2f} s at {speed:.2f}x into {secs:.1f} s")
        ins = [x for p in parts for x in ("-i", str(p))]
        chain = "".join(f"[{k}:v]" for k in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=0[v]"
        if cap is not None:
            ins += ["-loop", "1", "-i", str(DEMO / f"captions{sfx}" / f"c{cap}.png")]
            chain += f";[{len(parts)}:v]format=rgba,fade=in:st=0.25:d=0.3:alpha=1[c];[v][c]overlay=x=(W-w)/2:y={K['cap_bottom']}-h:shortest=1,format=yuv420p[o]"
        else:
            chain += ";[v]format=yuv420p[o]"
        f = seg / f"{name}.mp4"
        run(*ins, "-filter_complex", chain, "-map", "[o]", "-c:v", "libx264", "-preset", "fast", "-crf", "10", "-an", str(f))
        files.append(f)
        starts.append(t)
        t += sum(c[3] for c in clips) * BEAT
    total = t
    # Joined: scenes that come in on a cut are concatenated first, then the groups crossfaded at their beats.
    groups: list[tuple[float, float, list[Path]]] = []
    for i, f in enumerate(files):
        if i and fades[i] == 0:
            groups[-1][2].append(f)
        else:
            groups.append((starts[i], fades[i], [f]))
    ins, chain = [], ""
    for g, (_, _, fs) in enumerate(groups):
        for f in fs:
            ins += ["-i", str(f)]
    k = 0
    for g, (_, _, fs) in enumerate(groups):
        chain += "".join(f"[{k + j}:v]" for j in range(len(fs))) + f"concat=n={len(fs)}:v=1:a=0,settb=AVTB,fps={FPS}[g{g}];"
        k += len(fs)
    last = "g0"
    for g in range(1, len(groups)):
        start, fade, _ = groups[g]
        chain += f"[{last}][g{g}]xfade=transition=fade:duration={fade}:offset={start:.3f}[x{g}];"
        last = f"x{g}"
    chain += f"[{last}]fade=out:st={total - 0.8:.3f}:d=0.8,format=yuv420p[o]"
    silent = OUT / f"trailer-{kind}.mp4"
    run(*ins, "-filter_complex", chain, "-map", "[o]", "-t", f"{total:.3f}", "-c:v", "libx264", "-preset", "slow", "-crf", str(K["crf"]), "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(silent))
    print(f"{silent.name}: {total:.1f} s")
    for letter, wav in tracks.items():
        out = OUT / f"trailer-{kind}-{letter}.mp4"
        run("-i", str(silent), "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out))
        print(out.name)


if __name__ == "__main__":
    args = sys.argv[1:]
    kinds = [a for a in args if a in KINDS] or (list(KINDS) if not args or args[0] == "both" or "=" in args[0] else [])
    tracks = dict(a.split("=", 1) for a in args if "=" in a)
    for kind in kinds:
        encode(kind, tracks)
