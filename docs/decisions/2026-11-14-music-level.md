# The music's level: a little under the game's sounds (Nov 14)

Eric: "music volume should fit with normal, a little quieter than the game, that's what every game does." `MUSIC.volume` 0.25 → **0.4**
(+4.1 dB). Measured in Chromium at the speakers' input (the destination's, the built code's own paths), K-weighted: the clown theme's
short-term loudness -30.2 → -26.2 LUFS (its beats, 100 ms windows' 95th percentile, -27.2 → -23.1), against each sound's hit (its loudest
100 ms): move -23.2, clock tick -23.3, capture -21.0, Folio's voice -23.0, Big Boy's clack -18.6, menu open -14.1. So 3 dB under a move,
its beats level with one, never above. 0.5 (the brief's guess, 0.5-0.7) put its beats at -21.1, louder than a move, and the loudest
theme (Hidden Boss phase 3, 1.7 dB hotter) louder than a capture: too loud by Eric's rule. Effects unchanged.
Also: a new copy of a theme cuts one still fading out at its end to `handoffMs` (`cutEnding`): a room walked back into, a rematch, a
result into a new splash, a called-off splash into the room had two copies for up to 1.5 s. And the context handover now carries
music the battle took over from its splash mid-handover (it was left on the old context, to go silent). Sample rate: the device's
(44100 Hz in the test browser; no context sets one).
