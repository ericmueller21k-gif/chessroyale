# Sounds Eric has judged by ear

For whoever writes the next boss themes. The helper can't hear, so these verdicts are the only ear there is: start
from the liked list, keep off the other one. Eric's words are quoted; the date is 2026.

## Liked: reach for these first

| Sound | Where it is | What Eric said |
|---|---|---|
| Fiddle | `Mix.fiddle` (synth.py) | Nov 11, of seven leads tried on the woodshop songs: "Fiddle, gritty, both great, square too ... make a note I liked these sounds for next bosses" |
| Gritty driven synth lead | `Mix.gritty` | the same |
| Square lead (the old console's) | `Mix.chip` | the same; on Jefferson's it was "a close 2nd" |
| Low marimba and pan flute, dueling and in harmony | song_m.py | "Flute and marimba are badass" |
| A slightly out-of-tune waveform piano, slow and spaced out | song_n.py (`piano`) | "it's honestly perfect" |
| Bowed violin in long pulls, two violins dueling, an octobass | song_o.py | "the dueling violins and stuff you did are great" |
| An 808 and a wobble bass in a big drop: a hush, a giant boom, then the thump | song_n.py, song_o.py | "the drop is really good" |
| Glitch and trance effects in a drop (gated chord, stutters, zaps) | song_o.py | asked for, shipped |
| Toy blocks, xylophone and toy piano | song_k.py | "Perfect literally" |
| A music box, heartbeat, creeping bass with the kit out ("lights out") | song_l.py, bars 29-34 | "so fucking good" |
| Rockets, booms, crackle, sparkles; hand drums; a low chant | song_m.py | "It's perfect" |
| An overdriven lead (the 16-bit consoles' lead guitar), built from measurements of a reference he sent | `Mix.drive` | of the reference: "a really badass instrument"; of the build's sample: "swap that instrument with the one that's currently in his actual completed one" (it is Sawyer's lead) |
| A talking synth (each note a "wah") in small doses, and the cow's moos, kept quiet | song_r.py (`talk`, `moo`) | "the moos and the noise that sounds like anime wawawa or something is nice"; then, when given eight bars of it, "I didn't want more of it. I was just saying I liked it", and "turn down the moo volume a little bit" |
| Tunes off the grid: triplets, octave jumps that float back down, notes held over the bar line, three-bar phrases, a lead that slides into long notes; a chord a bar over a bass stepping down by half steps | song_r.py (`TUNE`, `VERSE`) | 25 seconds in: "this slaps bro, way sicker already, bro you nailed it" |
| A motif five 8ths long that lands somewhere new in the bar each time, over chords dropping by whole steps; and the last tune arriving a minor third up | song_r.py (`SHIFT`, bars 57-64) | "holy shit the key change and second tune was fire" |
| The whole band on a "tape" that doesn't run at one speed: it starts up from a groan, dies (pitch sinking as it slows), wavers off key in the calms, runs away two half steps sharp, and comes back a half step too high | song_s.py (`Ride`, `RIDE`) | Nov 12, of Boingo's first go: "This is flawless and your best work yet ... WOW this is so good" |
| A steam-organ whistle as the lead, its long notes landing sharp and springing into place | song_s.py (`whistle`) | the same |
| Bars that lose a beat, a motif seven 8ths long, five notes in two beats (a laugh), the tune turned upside down and played against itself in the drop | song_s.py (`LIMP`, `SHIFT`, `DROP_GRIT`, `DROP_PIPE`) | the same |
| Very short high dings over a deep bass that climbs and builds; a music box that sticks on two notes | song_s.py (`ding`, `eerie`, the first calm) | his own direction for it, then the same |
| The boss's own sounds (horn, kazoo laugh, slide whistle, a pie's splat), a few times each | song_s.py (`honk`, `laugh`, `slide`, `splat`) | the same |
| A fast pattern racing under everything | every song since song_i.py | asked for in all of them |
| The NES's four voices | song_c.py, song_f.py | "much much better" than the 16-bit orchestra |

## The recipe that worked: write the next themes this way

Eric on Moo & Moon's third go (song_r.py, Nov 12): "please whatever ... u did for this do it for the rest, this is pure
magic, i could listen to this anytime" (he meant: keep it in the notes for the bosses still to come). What that song
does, in the order it was built:

1. **The boss first.** Read his row in `docs/areas/bosses.md` and his sounds file in `packages/app/src/characters/`.
   The lead is the boss; a second voice is his sidekick, in small doses (a few words in the gaps, never a section of
   its own); two or three sounds from his world, built as the game builds them and kept quiet.
2. **Tunes off the grid.** Triplets across the beat, octave jumps that float back down, notes held over the bar line,
   phrases of three bars beside the usual two and four, a lead that slides into its long notes. Not: 8ths on the grid,
   two-bar question and answer, the same shape moved from chord to chord.
3. **A chord a bar**, the bass stepping (by half steps there) under one note that never moves and belongs to every
   chord; a chord from outside the key before the turn home.
4. **A second tune that shifts in the bar:** a motif of an odd length (five 8ths), so it lands somewhere new each
   time, over chords moving by whole steps.
5. **The last tune a minor third up**, and a short tag that walks home for the loop.
6. **Two calms of about 15 seconds:** no drums, slow strings on a chord with a raised fourth, the fast pattern at half
   speed, something of the boss's world (wind chimes for stargazing, stopped two bars early so none hangs), a flute; the
   lead playing slowly in one of them.
7. **One drop:** the lead and a second lead trade two bars each, then play together; chords a major third apart; an
   808, a wobble bass, a stutter at the end of each turn.
8. **The fast pattern is from his world** (stars) and keeps coming back to the note that never moves.
9. **Measure before sending:** each voice's level section by section, the spectrum against an approved song, the calm
   about 6 dB under the rest. Then send, and expect two or three rounds: the first go was "too slow ... too deep", the
   second "feels like the other ones a lot".

Vary the particulars from boss to boss (which way the bass steps, how long the shifting motif is, what the calm is
made of): the point is the kind of move, not these notes.

Boingo (song_s.py, Nov 12) followed it and went a step further, as Eric asked ("how you kind of went adventurous, this
one, even take it up another notch"): the bass steps up instead of down, the motif is seven 8ths, the calms are a
broken music box and a whistle three half steps flat, the drop is the tune upside down, and one idea from the boss's
world shapes the whole song (a merry-go-round whose speed changes). His verdict on the first go, with no changes
asked: "This is flawless and your best work yet." So for the next bosses: the recipe, plus one such idea from the
boss's world that reaches into how the song itself runs, not only its sounds.

## Not liked: avoid, or ask first

| Sound | What Eric said |
|---|---|
| A plain marimba or xylophone as the lead over a busy kit (songs P and Q, first go) | "whatever the heck is playing it I don't like it sounds really basic" |
| A thumb piano lead: a high, clicky struck-wood note with a pulse under it (song_m.py, first go) | "the only thing I don't like is whatever instrument is playing the main melody" |
| Low plucked strings (`Mix.pluck`, Karplus-Strong) as a bass or harp under a tune (song_o.py, first go) | "a really loose guitar string ... cut that from the whole thing" |
| Wind chimes ringing on in a calm or at a loop's end | "two chimes that hit weird ... left in the song" |
| A heroic major-key fanfare with brass, flute and bells (song_d.py) | "way too upbeat and happy" |
| Lots of brass (track_b.py) | "less brass, more of the other voices"; then "the 2nd song is awful" |
| A slow-down in the middle of a song (song_g.py) | "the slowdown didn't land, the speed up was cool tho". (A plain one. Boingo's song slows twice with the pitch sinking as it goes, the ride dying, which he asked for and called flawless.) |
| Tunes built from the same rhythm as the last boss's: 8ths on the grid, two-bar phrases, a chord every two bars (song_r.py, second go) | "it just feels like the other ones a lot ... work up the timings a little bit. Some of the chord progression and maybe even ... be adventurous a little" |
| A tune that runs up and down its chords, the same shape on chord after chord (song_j.py) | "very dull and boring, sounds like all the rest ... that style chord progression is slop" |

## What he asks of every theme

Two minutes from the start, loop-clean, an intro of its own; a fast pattern underneath; a switch every eight bars or
so (he liked Big Boy's variety most); instruments layered and trading in different parts; a slower, simpler stretch
somewhere; and where it fits, a drop. When he doesn't like a lead, send him short samples of the same tune on other
instruments: he picks fast.
