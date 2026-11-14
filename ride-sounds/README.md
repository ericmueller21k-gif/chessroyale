# Ride sounds: a sound for each ride while it moves (first two, to try in the town)

Eric (Nov 14): every ride in the town should make a sound as it moves ("I'm on like a bulldozer ... it sounds like ... a
little bulldozer moving"); no idle sound; one continuous sound, not one per key press. He picked these two from samples
and wants to try them in the town before the other rides get theirs: "we want to kind of test this on two of them here,
and then we'll kind of go more. I want to move around with it and see how it feels."

| Ride (id in crates.ts) | File | What it is |
|---|---|---|
| Sawyer's Dozer (`sawyer-dozer`) | `sawyer-dozer.wav` | a diesel's chug: twelve firings a second, its exhaust, the tracks ticking |
| Boingo's Pogo (`boingo-pogo`) | `boingo-pogo.wav` | a spring's boing on every bounce, four a second, a little tune in their pitches |

Made in code by `scripts/reel/music/rides.py --game <folder>` on `claude/trailer-v2` (no samples). `rides.json` has each
ride's numbers.

## The files

Mono WAV, 24 kHz, 16 bit, 1.2 s, 58 KB each. (WAV because it loops exactly: an MP3 has silence added at its ends. 24 kHz
because nothing in them is over 6 kHz: they have already been through the same low-pass the game's sounds get.) Each is
**one loop of exactly 1 s with 0.1 s of itself on either side**: play it looping between `loopStart` (0.1) and `loopEnd`
(1.1), starting at `loopStart`. The pads are there so a decoder that changes the sample rate has real sound on both sides
of the loop's ends, as the music's files have. With Web Audio: `source.loop = true; source.loopStart = 0.1;
source.loopEnd = 1.1; source.start(when, 0.1)`.

Level: each loop is -20 dB RMS (peaks -3.8 dB the dozer, -7.1 dB the pogo). It runs for as long as the pawn moves, so it
wants to sit well under a move's knock: a gain of about 0.3 is where I'd start. It belongs with the game's sounds (the
Sound switch, the page hidden), not with the music.

## How it should behave (Eric's words where he gave them; the rest is the proposal he heard in the samples)

- **While your pawn is moving on the ride, the loop plays; standing, nothing.** Your own ride only, to begin with.
- **Not once a step.** A step is 90 ms: the loop keeps its own pace whatever the steps do. Count the pawn as moving
  from its first step until a short while after its last (about 120 ms), so a turn or a tap between two steps doesn't
  stop and restart it.
- **Starting:** fade in over `fadeInMs` (60). An engine (`engine: true`, the dozer) also starts a little slow and comes up
  to speed: `playbackRate` from 0.8 to 1 over about 300 ms. The pogo starts on its first bounce (the loop's start is a
  bounce), at its own speed.
- **Stopping:** Eric: "when you stop moving, it doesn't just like instantly stop ... it kind of fades over like a second
  or whatever ... I guess we'll have to test it." So fade out over `fadeOutMs` (the dozer 700, the pogo 350: starting
  points), and let an engine sink a little as it goes (`playbackRate` down to about 0.88). **Make the fade times, the
  level and the 120 ms settings** (settings.ts), so he can change them as he tries it.
- **Moving again during the fade:** bring the gain (and an engine's speed) back up from where they are; don't start the
  loop again from silence.
- A ride with no entry in `rides.json` stays silent, as now. The other rides' loops will come in this same shape once he
  is happy with how these two feel.
