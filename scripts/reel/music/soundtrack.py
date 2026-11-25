"""Builds one listen-through track per song from the game's own music files (packages/app/public/music on main, with
its themes.json): the intro (if any), one pass of the loop, and a few seconds of the loop coming round again, fading.
For Eric's soundtrack page and zip (Nov 25: "a folder I can open on my phone right now and listen to all of the songs
for the whole game, or download it").

    python3 soundtrack.py <the game's music folder> <out folder>     (a `wav` folder beside the out folder holds the working files)

Writes an MP3 a song (160 kbps) and tracks.json (each song's group, file, title, note, icon and length), which the
page lists. A new boss is a line in the list below.
"""
import json, subprocess, sys, wave
import numpy as np
game, out = sys.argv[1], sys.argv[2]
SR = 48000
man = json.load(open(f"{game}/themes.json"))
pad = man["pad"]

def load(name):
    wav = f"{out}/../wav/{name}.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", f"{game}/{name}.mp3", "-ar", str(SR), "-ac", "2", wav], check=True)
    w = wave.open(wav)
    return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(float) / 32768

def save(name, x):
    wav = f"{out}/../wav/_{name}.wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(2), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", f"{out}/{name}.mp3"], check=True)
    return round(len(x) / SR, 1)

def song(intro, loop, intro_s, loop_s, passes=1.0, tail=5.0):
    """The intro, then the loop from its start for `passes` of its length, then `tail` seconds more of it, fading."""
    lp = load(loop)
    i0 = int(round(pad * SR)); n = int(round(loop_s * SR))
    one = lp[i0:i0 + n]
    body = np.concatenate([one] * int(np.ceil(passes + 1)))[: int(round(passes * n)) + int(tail * SR)]
    body[-int(tail * SR):] *= np.linspace(1, 0, int(tail * SR))[:, None] ** 1.5
    at = int(round(intro_s * SR))
    x = np.zeros((at + len(body), 2))
    x[at:] += body
    if intro:
        head = load(intro)[: len(x)]
        x[: len(head)] += head
    return x

T = man["themes"]
def theme(key, **kw):
    t = T[key]
    return song(t["intro"], t["loop"], t["introSeconds"] or 0.0, t["loopSeconds"], **kw)

# (file name, title, a line about it, the boss's icon in the game, how it is built)
tracks = []
def add(group, name, title, note, icon, x):
    tracks.append({"group": group, "file": f"{name}.mp3", "title": title, "note": note, "icon": icon, "seconds": save(name, x)})
    print(f"{name:22} {tracks[-1]['seconds']:6.1f} s  peak {20 * np.log10(np.abs(x).max()):.1f}")

town = man["town"]
add("Places", "town", "The town", "The square's theme", "🏘️", song(None, town["loop"], 0.0, town["loopSeconds"]))
for s in town["solos"]:
    add("Places", f"town-solo-{s['id']}", f"The town: piano solo {s['id'].upper()}", "Plays between passes of the town's theme", "🎹", load(s["file"]))
add("Places", "tower", "The battle tower", "The tower's theme", "🗼", theme("tower"))
for key, title, icon in (("gingerbread", "Ginger", "🍪"), ("clown", "Boingo the Clown", "🤡"), ("grex", "Jefferson", "🦖"), ("hollow", "Hollow", "🌑"), ("bigboy", "Big Boy", "🍭"),
                         ("sawyer", "Sawyer", "🪚"), ("pig", "Wrangler", "🤠"), ("alfil", "Alfil", "🦣"), ("hopper", "Chub & Chirp", "🐇"), ("smudgy", "Smudgy", "🦎"),
                         ("moo", "Moo & Moon", "🐄"), ("gardener", "Puddles", "🦛"), ("tiger", "Babur", "🐯"), ("folio", "Folio", "📜"), ("timber", "Timber", "🦫"),
                         ("dash", "Dash", "🐆"), ("zebra", "Don Dough", "🦓"), ("chandy", "Chandy", "🦎"), ("birdie", "Birdie", "🕊️")):
    add("Bosses", key, title, "Boss theme", icon, theme(key))
add("Bosses", "birdie-ult", "Birdie's ult: the crossing", "Plays once when his ult fires, then his theme from the top", "🚂", theme("birdie-ult", passes=0.11, tail=4.0))
add("The Hidden Boss", "recluse-house", "His room", "His room, and the fight with the child", "📕", theme("recluse-house"))
add("The Hidden Boss", "recluse-phase2", "The first fight", "The long stare, the build, then the fight", "📕", theme("recluse-phase2"))
add("The Hidden Boss", "recluse-phase3", "He transforms", "The transformation, the boards split, the rest of the fight", "📕", theme("recluse-phase3"))
json.dump(tracks, open(f"{out}/tracks.json", "w"), ensure_ascii=False, indent=1)
total = sum(t["seconds"] for t in tracks)
print(len(tracks), "tracks,", round(total / 60, 1), "minutes")
