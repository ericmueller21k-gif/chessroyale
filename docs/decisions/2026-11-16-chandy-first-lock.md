# Chandy: his first capture is his first lock; a new unlock fires at once; Dodge reworked (Nov 16, 2026)

Eric, playing him live: "the first piece of the game that he captures is always marked first"; "When he does get a new unlock, he
should use it right away"; Dodge: "an additional shot first", "you have to get hit twice", beams that travel and linger, a 5 s kill.

- No lock before his first capture (never steered); the crosshair marks the piece with his move known, before it shows (the server
  holds it, solo waits), then upgrade 1. **Call:** your queen too (Eric's "always"); never the king.
- `fireOnUnlock` (true): the unlock fires on his next turn; a queen lock that can't come waits for the meter.
- Dodge: volley, `dodgeHits` 2, about 28 s (31.6 s at most); placeholder sounds `chandyBeam`, `chandyCrack`, `chandyCrackle`,
  `chandyShatter`. Numbers: `reports/chandy-sim.md`.
