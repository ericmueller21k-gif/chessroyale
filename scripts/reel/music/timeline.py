"""The trailer's timeline, shared by both tracks: 150 beats a minute (a beat 0.4 s, a bar of four 1.6 s), 136 beats =
54.4 s, beat 0 at the first frame. scripts/reel/encode-trailer.py cuts the picture to these same times (its SLOTS).

  beat   0   0.0 s  50 v 50
  beat  12   4.8 s  the town by day (the chat moving)
  beat  36  14.4 s  the town at night, on the ride (a crossfade)
  beat  48  19.2 s  Big Boy: his card (48), in at his door (50), his blocks build the table (52)
  beat  60  24.0 s  his candy swirl fills the screen
  beat  64  25.6 s  the boss mashup: four cuts of six beats (64, 70, 76, 82)
  beat  88  35.2 s  Squads
  beat 100  40.0 s  ranked: the duel
  beat 107  42.8 s  the run up the ranks: one note per rank (RUN_AT: the shuffle's own quickening steps)
  beat 112  44.8 s  Transcendent lands
  beat 116  46.4 s  the Hidden Boss, to the end (a fade to black over the last two beats)
  beat 136  54.4 s  the loop point
"""
BPM = 150.0
BEATS = 136
SECS = BEATS * 60 / BPM
# The rank shuffle's holds (scripts/reel/rank-shuffle.ts: 380, 320, 270, 230, 200, 180, 170, 230 ms) from beat 107.
_holds = [0.38, 0.32, 0.27, 0.23, 0.20, 0.18, 0.17]
RUN_AT = [107.0]
for h in _holds:
    RUN_AT.append(RUN_AT[-1] + h / 0.4)
MASH = [64, 70, 76, 82]
