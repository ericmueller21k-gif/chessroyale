# Puddles' voice: quick, high, made-up talk (Oct 23, 2026)

**Eric (Oct 23):** "I want his talking to be... like in Pikmin. It's like not real words, and they say it kind of fast, like in
higher pitch. Whereas right now has like a deeper tone, and it almost sounds like the same as the cow." The director made three
samples (a high chatter at 430 Hz, a lower one at 290, a squeaky one at 560; each short, medium and long, by the synth's own
blocks). Eric: "that's perfect. Just make it a little bit lower tone... it's just slightly too high pitched."

**What changed** (`packages/app/src/characters/gardener-sounds.ts`, `talk`): his voice is quick made-up syllables at 370 Hz
(the first sample's 430, a little lower), each 55 to 85 ms, a bright pulse through the two formants of a vowel picked from a
few (a small speaker's: an adult's times 1.22), most with a little "p/t" click at the start, on a sing-song line that rises in
the middle and drops at the end. Seeded, so the same every time.

| Sound | Cue | Now |
| --- | --- | --- |
| `grunt` | his entrance, a capture, a check, a win, the attack's last | 4 syllables (0.4 s) |
| `cheer` | a piece grew | 6, a little higher, ending up (0.6 s) |
| `bellow` | `whoop`, a queen grew | 10, higher and climbing (0.9 s) |
| `hello` | the select screen | 4, then the splash |
| `oof` | hurt | "uh-oh", 2 falling (0.2 s) |
| `sigh` | the shrug (nothing came up) | 3 slower, lower, falling, "oh well" (0.4 s) |

The names stay (the cues, kits and the sound worker's warm list use them). His body's sounds (thumps, the flop), the hose and the
plants are as they were. Loudness as before (within 2 dB), every one under a move's peak and loudness (the #271 test).

Tool for samples (not in the repo): the director's `babble.ts` in the session scratchpad, which renders flavors to WAV.
